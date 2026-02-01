use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::commitment_repo::{CommitmentRow, CreateCommitmentInput};
use crate::middleware::jwt_auth::AuthUser;
use crate::routes::auth::AppState;
use crate::services::commitment_service;

// ============ Create Commitment ============

#[derive(Debug, Deserialize)]
pub struct CreateCommitmentReq {
    pub opponent_wallet: Option<String>,
    pub kind: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub amount: i64, // in lamports for SOL
    #[serde(default = "default_currency")]
    pub currency: String,
    pub start_at: Option<DateTime<Utc>>,
    pub end_at: Option<DateTime<Utc>>,
    pub meta: Option<serde_json::Value>,
}

fn default_currency() -> String {
    "SOL".to_string()
}

#[derive(Debug, Serialize)]
pub struct CommitmentResponse {
    pub commitment: CommitmentRow,
}

/// POST /commitments
/// Create a new commitment
pub async fn create_commitment(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateCommitmentReq>,
) -> Result<Json<CommitmentResponse>, StatusCode> {
    // Validate amount
    if body.amount <= 0 {
        return Err(StatusCode::BAD_REQUEST);
    }

    let input = CreateCommitmentInput {
        opponent_id: None,
        opponent_wallet: body.opponent_wallet,
        kind: body.kind,
        title: body.title,
        description: body.description,
        amount: body.amount,
        currency: body.currency,
        start_at: body.start_at,
        end_at: body.end_at,
        meta: body.meta,
    };

    let commitment = commitment_service::create_commitment(&state.pool, auth.user_id, input)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create commitment: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(CommitmentResponse { commitment }))
}

// ============ Get Commitment ============

/// GET /commitments/:id
/// Get a commitment by ID
pub async fn get_commitment(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<CommitmentResponse>, StatusCode> {
    let commitment = commitment_service::get_commitment(&state.pool, id)
        .await
        .map_err(|e| match e {
            commitment_service::CommitmentError::NotFound => StatusCode::NOT_FOUND,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        })?;

    Ok(Json(CommitmentResponse { commitment }))
}

// ============ List My Commitments ============

#[derive(Debug, Deserialize)]
pub struct ListCommitmentsQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

fn default_limit() -> i64 {
    20
}

#[derive(Debug, Serialize)]
pub struct ListCommitmentsResponse {
    pub commitments: Vec<CommitmentRow>,
    pub total: i64,
}

/// GET /commitments
/// List user's commitments
pub async fn list_commitments(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<ListCommitmentsQuery>,
) -> Result<Json<ListCommitmentsResponse>, StatusCode> {
    let limit = query.limit.min(100).max(1);
    let offset = query.offset.max(0);

    let commitments =
        commitment_service::list_user_commitments(&state.pool, auth.user_id, limit, offset)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list commitments: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    let total = crate::db::commitment_repo::count_for_user(&state.pool, auth.user_id)
        .await
        .unwrap_or(0);

    Ok(Json(ListCommitmentsResponse { commitments, total }))
}

// ============ List Open Challenges ============

/// GET /commitments/open
/// List open challenges available to join
pub async fn list_open_challenges(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<ListCommitmentsQuery>,
) -> Result<Json<ListCommitmentsResponse>, StatusCode> {
    let limit = query.limit.min(100).max(1);
    let offset = query.offset.max(0);

    let commitments =
        commitment_service::list_open_challenges(&state.pool, auth.user_id, limit, offset)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list open challenges: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    Ok(Json(ListCommitmentsResponse { 
        total: commitments.len() as i64,
        commitments, 
    }))
}

// ============ Join Commitment ============

/// POST /commitments/:id/join
/// Join a commitment as opponent
pub async fn join_commitment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<CommitmentResponse>, StatusCode> {
    let commitment = commitment_service::join_commitment(&state.pool, id, auth.user_id)
        .await
        .map_err(|e| {
            tracing::warn!("Failed to join commitment: {}", e);
            match e {
                commitment_service::CommitmentError::NotFound => StatusCode::NOT_FOUND,
                commitment_service::CommitmentError::CannotJoinOwn => StatusCode::BAD_REQUEST,
                commitment_service::CommitmentError::AlreadyHasOpponent => StatusCode::CONFLICT,
                commitment_service::CommitmentError::InvalidStatusTransition(_, _) => {
                    StatusCode::CONFLICT
                }
                _ => StatusCode::INTERNAL_SERVER_ERROR,
            }
        })?;

    Ok(Json(CommitmentResponse { commitment }))
}

// ============ Record Deposit ============

#[derive(Debug, Deserialize)]
pub struct DepositReq {
    pub tx_signature: String,
}

/// POST /commitments/:id/deposit
/// Record a deposit (either creator or opponent based on auth)
pub async fn record_deposit(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<DepositReq>,
) -> Result<Json<CommitmentResponse>, StatusCode> {
    // Get commitment to determine if user is creator or opponent
    let existing = commitment_service::get_commitment(&state.pool, id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    let commitment = if existing.creator_id == auth.user_id {
        commitment_service::record_creator_deposit(&state.pool, id, auth.user_id, &body.tx_signature)
            .await
    } else if existing.opponent_id == Some(auth.user_id) {
        commitment_service::record_opponent_deposit(&state.pool, id, auth.user_id, &body.tx_signature)
            .await
    } else {
        return Err(StatusCode::FORBIDDEN);
    };

    let commitment = commitment.map_err(|e| {
        tracing::error!("Failed to record deposit: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(CommitmentResponse { commitment }))
}

// ============ Activate Commitment ============

/// POST /commitments/:id/activate
/// Activate a locked commitment (system/admin endpoint)
pub async fn activate_commitment(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<CommitmentResponse>, StatusCode> {
    let commitment = commitment_service::activate_commitment(&state.pool, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to activate commitment: {}", e);
            match e {
                commitment_service::CommitmentError::InvalidStatusTransition(_, _) => {
                    StatusCode::CONFLICT
                }
                _ => StatusCode::INTERNAL_SERVER_ERROR,
            }
        })?;

    Ok(Json(CommitmentResponse { commitment }))
}

// ============ Start Resolution ============

/// POST /commitments/:id/resolve
/// Move commitment to resolving state
pub async fn start_resolution(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<CommitmentResponse>, StatusCode> {
    let commitment = commitment_service::start_resolution(&state.pool, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to start resolution: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(CommitmentResponse { commitment }))
}

// ============ Settle Commitment ============

#[derive(Debug, Deserialize)]
pub struct SettleReq {
    pub winner_id: Uuid,
    pub tx_settle: String,
}

/// POST /commitments/:id/settle
/// Settle commitment with winner (system/admin endpoint)
pub async fn settle_commitment(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<SettleReq>,
) -> Result<Json<CommitmentResponse>, StatusCode> {
    let commitment =
        commitment_service::settle_commitment(&state.pool, id, body.winner_id, &body.tx_settle)
            .await
            .map_err(|e| {
                tracing::error!("Failed to settle commitment: {}", e);
                match e {
                    commitment_service::CommitmentError::Unauthorized => StatusCode::FORBIDDEN,
                    commitment_service::CommitmentError::InvalidStatusTransition(_, _) => {
                        StatusCode::CONFLICT
                    }
                    _ => StatusCode::INTERNAL_SERVER_ERROR,
                }
            })?;

    Ok(Json(CommitmentResponse { commitment }))
}

// ============ Cancel Commitment ============

/// POST /commitments/:id/cancel
/// Cancel a pending commitment
pub async fn cancel_commitment(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<CommitmentResponse>, StatusCode> {
    let commitment = commitment_service::cancel_commitment(&state.pool, id, auth.user_id)
        .await
        .map_err(|e| {
            tracing::warn!("Failed to cancel commitment: {}", e);
            match e {
                commitment_service::CommitmentError::Unauthorized => StatusCode::FORBIDDEN,
                commitment_service::CommitmentError::InvalidStatusTransition(_, _) => {
                    StatusCode::CONFLICT
                }
                _ => StatusCode::INTERNAL_SERVER_ERROR,
            }
        })?;

    Ok(Json(CommitmentResponse { commitment }))
}

// ============ Check and Auto-Settle ============

#[derive(Debug, Deserialize)]
pub struct CheckSettleReq {
    pub app_usage_minutes: i64,
}

#[derive(Debug, Serialize)]
pub struct CheckSettleResponse {
    pub commitment: CommitmentRow,
    pub settled: bool,
    pub winner_id: Option<Uuid>,
    pub reason: String,
}

/// POST /commitments/:id/check-and-settle
/// Check screen time and auto-settle if user exceeded limit
pub async fn check_and_settle(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
    Json(body): Json<CheckSettleReq>,
) -> Result<Json<CheckSettleResponse>, StatusCode> {
    let commitment = commitment_service::get_commitment(&state.pool, id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;

    // Allow checking for active, locked, or pending commitments
    let valid_statuses = vec![
        crate::db::commitment_repo::CommitmentStatus::Active,
        crate::db::commitment_repo::CommitmentStatus::Locked,
        crate::db::commitment_repo::CommitmentStatus::Pending,
    ];
    
    let status_str = commitment.status.to_string();
    if !valid_statuses.contains(&commitment.status) {
        return Ok(Json(CheckSettleResponse {
            commitment,
            settled: false,
            winner_id: None,
            reason: format!("Commitment status is '{}', cannot check", status_str),
        }));
    }

    // Verify user is a participant
    let is_creator = commitment.creator_id == auth.user_id;
    let is_opponent = commitment.opponent_id == Some(auth.user_id);
    let is_solo = commitment.opponent_id.is_none();
    
    if !is_creator && !is_opponent {
        return Err(StatusCode::FORBIDDEN);
    }

    // Get time limit from meta
    let time_limit = commitment.meta
        .get("time_limit_minutes")
        .and_then(|v| v.as_i64())
        .unwrap_or(60);

    // Check if user exceeded limit
    if body.app_usage_minutes >= time_limit {
        // User exceeded limit - they lose
        let winner_id = if is_solo {
            // For solo stake, there's no winner when user loses
            // We use a special UUID to indicate "house wins"
            // But for now, we'll just mark it as settled with creator as winner if they win
            // If they lose, we need to handle it differently
            
            // Actually for solo stakes when user LOSES, we still set winner_id to something
            // Let's use the creator_id but the release logic already handles solo stakes
            commitment.creator_id // This will be ignored in release for solo losses
        } else {
            // Head-to-head: opponent wins
            if is_creator {
                commitment.opponent_id.ok_or(StatusCode::BAD_REQUEST)?
            } else {
                commitment.creator_id
            }
        };

        let tx_settle = format!("auto-settle-{}", chrono::Utc::now().timestamp());
        
        // For solo stakes where user loses, we need special handling
        if is_solo {
            // User lost their solo stake - mark as settled but no release
            let updated = crate::db::commitment_repo::settle(
                &state.pool, 
                id, 
                winner_id, // Using creator_id as placeholder 
                &tx_settle
            )
            .await
            .map_err(|e| {
                tracing::error!("Failed to auto-settle solo: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

            // Log the loss (no release transaction - stake is forfeited)
            crate::services::commitment_service::log_event_public(
                &state.pool,
                id,
                Some(&commitment.status.to_string()),
                "released",
                Some(auth.user_id),
                "system",
                Some("Solo stake lost - exceeded time limit"),
            )
            .await
            .ok();

            return Ok(Json(CheckSettleResponse {
                commitment: updated,
                settled: true,
                winner_id: None, // No winner for solo loss
                reason: format!(
                    "You exceeded time limit ({}m used, {}m limit). Stake forfeited.", 
                    body.app_usage_minutes, 
                    time_limit
                ),
            }));
        }
        
        let updated = commitment_service::settle_commitment(
            &state.pool, 
            id, 
            winner_id, 
            &tx_settle
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to auto-settle: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        return Ok(Json(CheckSettleResponse {
            commitment: updated,
            settled: true,
            winner_id: Some(winner_id),
            reason: format!(
                "User exceeded time limit ({}m used, {}m limit)", 
                body.app_usage_minutes, 
                time_limit
            ),
        }));
    }

    Ok(Json(CheckSettleResponse {
        commitment,
        settled: false,
        winner_id: None,
        reason: format!(
            "Within limit ({}m used, {}m limit)", 
            body.app_usage_minutes, 
            time_limit
        ),
    }))
}
