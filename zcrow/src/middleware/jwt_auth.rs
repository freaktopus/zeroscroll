use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::Deserialize;
use uuid::Uuid;

use crate::routes::auth::AppState;

#[derive(Debug, Deserialize)]
struct Claims {
    sub: String,
    wallet: String,
    exp: usize,
    iat: usize,
}

/// Authenticated user extracted from JWT
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub wallet: String,
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = StatusCode;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        // Read Authorization: Bearer <token>
        let auth = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or(StatusCode::UNAUTHORIZED)?;

        let token = auth
            .strip_prefix("Bearer ")
            .ok_or(StatusCode::UNAUTHORIZED)?;

        // Decode and validate JWT
        let data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(state.jwt_secret.as_bytes()),
            &Validation::default(),
        )
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

        let user_id =
            Uuid::parse_str(&data.claims.sub).map_err(|_| StatusCode::UNAUTHORIZED)?;

        Ok(AuthUser {
            user_id,
            wallet: data.claims.wallet,
        })
    }
}
