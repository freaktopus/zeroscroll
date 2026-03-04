use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::db::{profile_repo, user_repo};
use crate::services::auth_service;
use crate::services::auth_service::WalletAuthResult;

/// Shared application state
#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub jwt_secret: String,
}

// ============ Challenge Endpoint ============

#[derive(Debug, Deserialize)]
pub struct ChallengeReq {
    pub wallet_pubkey: String,
}

#[derive(Debug, Serialize)]
pub struct ChallengeRes {
    pub nonce: Uuid,
    pub message: String,
    pub expires_at: String,
}

/// POST /auth/challenge
/// Request a challenge message to sign with wallet
pub async fn challenge(
    State(state): State<AppState>,
    Json(body): Json<ChallengeReq>,
) -> Result<Json<ChallengeRes>, StatusCode> {
    let wallet = body.wallet_pubkey.trim();
    if wallet.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let ch = auth_service::create_challenge(&state.pool, wallet)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create challenge: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(ChallengeRes {
        nonce: ch.nonce,
        message: ch.message,
        expires_at: ch.expires_at.to_rfc3339(),
    }))
}

// ============ Wallet Login Endpoint ============

#[derive(Debug, Deserialize)]
pub struct WalletAuthReq {
    pub wallet_pubkey: String,
    pub wallet_label: Option<String>,
    pub nonce: Uuid,
    pub signature: String, // base58 or base64
}

#[derive(Debug, Serialize)]
pub struct WalletAuthRes {
    pub is_new: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<user_repo::UserRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile: Option<profile_repo::ProfileRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registration_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wallet_pubkey: Option<String>,
}

/// POST /auth/wallet
/// Verify wallet signature — returns full auth for existing users, registration token for new users
pub async fn wallet_login(
    State(state): State<AppState>,
    Json(body): Json<WalletAuthReq>,
) -> Result<Json<WalletAuthRes>, StatusCode> {
    let wallet = body.wallet_pubkey.trim();
    if wallet.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let result = auth_service::verify_and_login(
        &state.pool,
        &state.jwt_secret,
        wallet,
        body.wallet_label.as_deref(),
        body.nonce,
        &body.signature,
    )
    .await
    .map_err(|e| {
        tracing::warn!("Auth failed: {}", e);
        StatusCode::UNAUTHORIZED
    })?;

    match result {
        WalletAuthResult::ExistingUser(auth) => Ok(Json(WalletAuthRes {
            is_new: false,
            user: Some(auth.user),
            profile: Some(auth.profile),
            access_token: Some(auth.access_token),
            registration_token: None,
            wallet_pubkey: None,
        })),
        WalletAuthResult::NewUser { registration_token, wallet_pubkey } => Ok(Json(WalletAuthRes {
            is_new: true,
            user: None,
            profile: None,
            access_token: None,
            registration_token: Some(registration_token),
            wallet_pubkey: Some(wallet_pubkey),
        })),
    }
}

// ============ Register Endpoint ============

#[derive(Debug, Deserialize)]
pub struct RegisterReq {
    pub registration_token: String,
    pub username: String,
    pub display_name: String,
}

#[derive(Debug, Serialize)]
pub struct RegisterRes {
    pub user: user_repo::UserRow,
    pub profile: profile_repo::ProfileRow,
    pub access_token: String,
}

/// POST /auth/register
/// Complete registration with username and display name (requires valid registration token)
pub async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterReq>,
) -> Result<Json<RegisterRes>, (StatusCode, String)> {
    let username = body.username.trim();
    let display_name = body.display_name.trim();

    // Validate username
    if username.len() < 3 || username.len() > 20 {
        return Err((StatusCode::BAD_REQUEST, "Username must be 3-20 characters".to_string()));
    }
    if !username.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
        return Err((StatusCode::BAD_REQUEST, "Username can only contain letters, numbers, and underscores".to_string()));
    }

    // Validate display name
    if display_name.is_empty() || display_name.len() > 50 {
        return Err((StatusCode::BAD_REQUEST, "Display name must be 1-50 characters".to_string()));
    }

    let auth = auth_service::complete_registration(
        &state.pool,
        &state.jwt_secret,
        &body.registration_token,
        username,
        display_name,
    )
    .await
    .map_err(|e| {
        tracing::warn!("Registration failed: {}", e);
        let msg = e.to_string();
        if msg.contains("username is already taken") {
            (StatusCode::CONFLICT, "Username is already taken".to_string())
        } else if msg.contains("invalid token") || msg.contains("ExpiredSignature") {
            (StatusCode::UNAUTHORIZED, "Registration token expired. Please connect wallet again.".to_string())
        } else {
            (StatusCode::INTERNAL_SERVER_ERROR, "Registration failed".to_string())
        }
    })?;

    Ok(Json(RegisterRes {
        user: auth.user,
        profile: auth.profile,
        access_token: auth.access_token,
    }))
}
