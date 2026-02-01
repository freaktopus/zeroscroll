use axum::{extract::State, http::StatusCode, Json};
use axum::extract::Path;
use serde::{Deserialize, Serialize};

use crate::db::profile_repo::{self, ProfileRow};
use crate::middleware::jwt_auth::AuthUser;
use crate::routes::auth::AppState;

// ============ Get My Profile ============

#[derive(Debug, Serialize)]
pub struct MeResponse {
    pub profile: ProfileRow,
}

/// GET /me
/// Get current user's profile
pub async fn get_me(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<Json<MeResponse>, StatusCode> {
    let profile = profile_repo::get_by_user_id(&state.pool, auth.user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get profile: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(MeResponse { profile }))
}

// ============ Set Username ============

#[derive(Debug, Deserialize)]
pub struct UsernameReq {
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct UsernameRes {
    pub profile: ProfileRow,
}

/// PATCH /me/username
/// Set or update username (must be unique)
pub async fn set_username(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<UsernameReq>,
) -> Result<Json<UsernameRes>, StatusCode> {
    let username = body.username.trim();

    // Validate username
    if username.len() < 3 || username.len() > 20 {
        return Err(StatusCode::BAD_REQUEST);
    }
    if !username
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_')
    {
        return Err(StatusCode::BAD_REQUEST);
    }

    let profile = profile_repo::set_username(&state.pool, auth.user_id, username)
        .await
        .map_err(|e| {
            tracing::warn!("Failed to set username: {}", e);
            StatusCode::CONFLICT // Username likely taken
        })?;

    Ok(Json(UsernameRes { profile }))
}

// ============ Update Profile ============

#[derive(Debug, Deserialize)]
pub struct UpdateProfileReq {
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UpdateProfileRes {
    pub profile: ProfileRow,
}

/// PATCH /me/profile
/// Update profile details
pub async fn update_profile(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<UpdateProfileReq>,
) -> Result<Json<UpdateProfileRes>, StatusCode> {
    let profile = profile_repo::update_profile(
        &state.pool,
        auth.user_id,
        body.display_name.as_deref(),
        body.avatar_url.as_deref(),
        body.bio.as_deref(),
    )
    .await
    .map_err(|e| {
        tracing::error!("Failed to update profile: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(UpdateProfileRes { profile }))
}

// ============ Check Username Availability ============

#[derive(Debug, Deserialize)]
pub struct CheckUsernameReq {
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct CheckUsernameRes {
    pub available: bool,
}

/// GET /username/check?username=xxx
/// Check if username is available
pub async fn check_username(
    State(state): State<AppState>,
    axum::extract::Query(query): axum::extract::Query<CheckUsernameReq>,
) -> Result<Json<CheckUsernameRes>, StatusCode> {
    let available = profile_repo::is_username_available(&state.pool, &query.username)
        .await
        .map_err(|e| {
            tracing::error!("Failed to check username: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(CheckUsernameRes { available }))
}

// ============ User Search (for finding opponents) ============

#[derive(Debug, Serialize)]
pub struct UserWithProfile {
    pub user: UserInfo,
    pub profile: ProfileRow,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub id: String,
    pub wallet_pubkey: String,
}

/// GET /users/wallet/:wallet_pubkey
/// Get user by wallet address
pub async fn get_user_by_wallet(
    State(state): State<AppState>,
    Path(wallet_pubkey): Path<String>,
) -> Result<Json<UserWithProfile>, StatusCode> {
    let result = sqlx::query!(
        r#"
        SELECT 
            u.id as user_id,
            u.wallet_pubkey,
            p.user_id as profile_user_id,
            p.username,
            p.display_name,
            p.avatar_url,
            p.bio,
            p.updated_at as profile_updated_at
        FROM users u
        LEFT JOIN profiles p ON u.id = p.user_id
        WHERE u.wallet_pubkey = $1
        "#,
        wallet_pubkey
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get user by wallet: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match result {
        Some(row) => {
            let profile = ProfileRow {
                user_id: row.user_id,
                username: row.username,
                display_name: row.display_name,
                avatar_url: row.avatar_url,
                bio: row.bio,
                updated_at: row.profile_updated_at,
            };

            Ok(Json(UserWithProfile {
                user: UserInfo {
                    id: row.user_id.to_string(),
                    wallet_pubkey: row.wallet_pubkey,
                },
                profile,
            }))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

/// GET /users/username/:username
/// Get user by username
pub async fn get_user_by_username(
    State(state): State<AppState>,
    Path(username): Path<String>,
) -> Result<Json<UserWithProfile>, StatusCode> {
    let result = sqlx::query!(
        r#"
        SELECT 
            u.id as user_id,
            u.wallet_pubkey,
            p.user_id as profile_user_id,
            p.username,
            p.display_name,
            p.avatar_url,
            p.bio,
            p.updated_at as profile_updated_at
        FROM profiles p
        INNER JOIN users u ON p.user_id = u.id
        WHERE p.username = $1
        "#,
        username
    )
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get user by username: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    match result {
        Some(row) => {
            let profile = ProfileRow {
                user_id: row.profile_user_id,
                username: row.username,
                display_name: row.display_name,
                avatar_url: row.avatar_url,
                bio: row.bio,
                updated_at: row.profile_updated_at,
            };

            Ok(Json(UserWithProfile {
                user: UserInfo {
                    id: row.user_id.to_string(),
                    wallet_pubkey: row.wallet_pubkey,
                },
                profile,
            }))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}
