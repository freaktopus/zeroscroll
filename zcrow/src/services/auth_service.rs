use crate::db::{nonce_repo, profile_repo, user_repo};
use base64::Engine;
use chrono::{Duration, Utc};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,    // user_id
    pub wallet: String, // wallet pubkey
    pub exp: usize,
    pub iat: usize,
}

pub struct Challenge {
    pub nonce: Uuid,
    pub message: String,
    pub expires_at: chrono::DateTime<Utc>,
}

pub struct AuthResult {
    pub is_new: bool,
    pub user: user_repo::UserRow,
    pub profile: profile_repo::ProfileRow,
    pub access_token: String,
}

/// Result of wallet verification — either an existing user login or a new user pending registration
pub enum WalletAuthResult {
    /// Existing user — fully authenticated
    ExistingUser(AuthResult),
    /// New wallet — needs registration with username + display_name
    NewUser {
        registration_token: String,
        wallet_pubkey: String,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RegistrationClaims {
    pub wallet: String,
    pub purpose: String,
    pub exp: usize,
    pub iat: usize,
}

/// Create a challenge for wallet signature verification
pub async fn create_challenge(pool: &PgPool, wallet_pubkey: &str) -> anyhow::Result<Challenge> {
    let nonce = Uuid::new_v4();
    let expires_at = Utc::now() + Duration::minutes(5);

    let message = format!(
        "ZCrow Sign-In\nWallet: {}\nNonce: {}\nIssued At: {}\n",
        wallet_pubkey,
        nonce,
        Utc::now().to_rfc3339(),
    );

    nonce_repo::insert_nonce(pool, nonce, wallet_pubkey, &message, expires_at).await?;

    Ok(Challenge {
        nonce,
        message,
        expires_at,
    })
}

/// Verify wallet signature and login (existing user) or issue registration token (new user)
pub async fn verify_and_login(
    pool: &PgPool,
    jwt_secret: &str,
    wallet_pubkey: &str,
    wallet_label: Option<&str>,
    nonce: Uuid,
    signature: &str,
) -> anyhow::Result<WalletAuthResult> {
    // Consume nonce (prevents replay)
    let message = nonce_repo::consume_nonce(pool, nonce, wallet_pubkey)
        .await?
        .ok_or_else(|| anyhow::anyhow!("invalid or expired nonce"))?;

    // Verify the signature
    verify_signature(wallet_pubkey, signature, message.as_bytes())?;

    // Check if user already exists
    if let Some(user) = user_repo::find_by_wallet(pool, wallet_pubkey).await? {
        // Existing user — update login timestamp and return full auth
        user_repo::update_last_login(pool, user.id).await?;
        let updated = user_repo::find_by_id(pool, user.id).await?.unwrap();
        let profile = profile_repo::ensure_profile(pool, updated.id).await?;
        let token = mint_jwt(jwt_secret, updated.id, &updated.wallet_pubkey)?;

        // Update wallet label if provided
        if let Some(label) = wallet_label {
            let _ = user_repo::update_wallet_label(pool, updated.id, label).await;
        }

        Ok(WalletAuthResult::ExistingUser(AuthResult {
            is_new: false,
            user: updated,
            profile,
            access_token: token,
        }))
    } else {
        // New wallet — don't create user yet, issue a registration token
        let reg_token = mint_registration_token(jwt_secret, wallet_pubkey)?;
        Ok(WalletAuthResult::NewUser {
            registration_token: reg_token,
            wallet_pubkey: wallet_pubkey.to_string(),
        })
    }
}

/// Complete registration: create user + profile with username and display name
pub async fn complete_registration(
    pool: &PgPool,
    jwt_secret: &str,
    registration_token: &str,
    username: &str,
    display_name: &str,
) -> anyhow::Result<AuthResult> {
    // Validate the registration token
    let wallet_pubkey = validate_registration_token(jwt_secret, registration_token)?;

    // Check if wallet was already registered (race condition guard)
    if let Some(existing) = user_repo::find_by_wallet(pool, &wallet_pubkey).await? {
        // Already registered — just return login
        let profile = profile_repo::ensure_profile(pool, existing.id).await?;
        let token = mint_jwt(jwt_secret, existing.id, &existing.wallet_pubkey)?;
        return Ok(AuthResult {
            is_new: false,
            user: existing,
            profile,
            access_token: token,
        });
    }

    // Check username availability
    if !profile_repo::is_username_available(pool, username).await? {
        anyhow::bail!("username is already taken");
    }

    // Create user
    let user = user_repo::create_user(pool, &wallet_pubkey, None).await?;

    // Create profile with username and display name
    let profile = profile_repo::create_profile_with_details(
        pool, user.id, username, display_name,
    ).await?;

    // Mint JWT
    let token = mint_jwt(jwt_secret, user.id, &user.wallet_pubkey)?;

    Ok(AuthResult {
        is_new: true,
        user,
        profile,
        access_token: token,
    })
}

/// Mint a short-lived registration token (proves wallet ownership for registration)
fn mint_registration_token(jwt_secret: &str, wallet: &str) -> anyhow::Result<String> {
    let now = Utc::now();
    let exp = now + Duration::minutes(10);

    let claims = RegistrationClaims {
        wallet: wallet.to_string(),
        purpose: "registration".to_string(),
        iat: now.timestamp() as usize,
        exp: exp.timestamp() as usize,
    };

    Ok(encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )?)
}

/// Validate a registration token and return the wallet pubkey
fn validate_registration_token(jwt_secret: &str, token: &str) -> anyhow::Result<String> {
    let data = decode::<RegistrationClaims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    )?;

    if data.claims.purpose != "registration" {
        anyhow::bail!("invalid token purpose");
    }

    Ok(data.claims.wallet)
}

/// Validate an existing JWT token and return claims
pub fn validate_token(jwt_secret: &str, token: &str) -> anyhow::Result<Claims> {
    let data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(data.claims)
}

/// Mint a new JWT token
fn mint_jwt(jwt_secret: &str, user_id: Uuid, wallet: &str) -> anyhow::Result<String> {
    let now = Utc::now();
    let exp = now + Duration::days(7);

    let claims = Claims {
        sub: user_id.to_string(),
        wallet: wallet.to_string(),
        iat: now.timestamp() as usize,
        exp: exp.timestamp() as usize,
    };

    Ok(encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(jwt_secret.as_bytes()),
    )?)
}

/// Verify ed25519 signature from Solana wallet
fn verify_signature(wallet_pubkey_b58: &str, sig_str: &str, msg: &[u8]) -> anyhow::Result<()> {
    // Decode base58 public key
    let pubkey = bs58::decode(wallet_pubkey_b58).into_vec()?;
    if pubkey.len() != 32 {
        anyhow::bail!("wallet_pubkey invalid length: expected 32, got {}", pubkey.len());
    }

    // Decode signature (try base58 first, then base64)
    let sig = decode_sig(sig_str)
        .ok_or_else(|| anyhow::anyhow!("signature must be base58 or base64"))?;
    if sig.len() != 64 {
        anyhow::bail!("signature invalid length: expected 64, got {}", sig.len());
    }

    // Verify
    let vk = VerifyingKey::from_bytes(pubkey.as_slice().try_into().unwrap())
        .map_err(|_| anyhow::anyhow!("invalid pubkey"))?;
    let signature = Signature::from_bytes(sig.as_slice().try_into().unwrap());

    vk.verify(msg, &signature)
        .map_err(|_| anyhow::anyhow!("signature verification failed"))?;

    Ok(())
}

/// Try to decode signature as base58, then base64
fn decode_sig(s: &str) -> Option<Vec<u8>> {
    // Try base58 first
    if let Ok(v) = bs58::decode(s).into_vec() {
        return Some(v);
    }
    // Try standard base64
    if let Ok(v) = base64::engine::general_purpose::STANDARD.decode(s) {
        return Some(v);
    }
    // Try URL-safe base64
    if let Ok(v) = base64::engine::general_purpose::URL_SAFE.decode(s) {
        return Some(v);
    }
    None
}
