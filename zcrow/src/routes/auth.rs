use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::db::{profile_repo, user_repo};
use crate::services::auth_service;

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
    pub user: user_repo::UserRow,
    pub profile: profile_repo::ProfileRow,
    pub access_token: String,
}

/// POST /auth/wallet
/// Verify wallet signature and login/register
pub async fn wallet_login(
    State(state): State<AppState>,
    Json(body): Json<WalletAuthReq>,
) -> Result<Json<WalletAuthRes>, StatusCode> {
    let wallet = body.wallet_pubkey.trim();
    if wallet.is_empty() {
        return Err(StatusCode::BAD_REQUEST);
    }

    let res = auth_service::verify_and_login(
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

    Ok(Json(WalletAuthRes {
        is_new: res.is_new,
        user: res.user,
        profile: res.profile,
        access_token: res.access_token,
    }))
}
