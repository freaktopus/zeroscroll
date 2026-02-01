use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::db::transaction_repo::{self, TransactionRow};
use crate::middleware::jwt_auth::AuthUser;
use crate::routes::auth::AppState;

// ============ List Transactions ============

#[derive(Debug, Deserialize)]
pub struct ListTransactionsQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

fn default_limit() -> i64 {
    20
}

#[derive(Debug, Serialize)]
pub struct ListTransactionsResponse {
    pub transactions: Vec<TransactionRow>,
}

/// GET /transactions
/// List user's transactions
pub async fn list_transactions(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<ListTransactionsQuery>,
) -> Result<Json<ListTransactionsResponse>, StatusCode> {
    let limit = query.limit.min(100).max(1);
    let offset = query.offset.max(0);

    let transactions =
        transaction_repo::list_for_user(&state.pool, auth.user_id, limit, offset)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list transactions: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?;

    Ok(Json(ListTransactionsResponse { transactions }))
}

// ============ Get Transaction ============

#[derive(Debug, Serialize)]
pub struct TransactionResponse {
    pub transaction: TransactionRow,
}

/// GET /transactions/:id
/// Get a transaction by ID
pub async fn get_transaction(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(id): Path<Uuid>,
) -> Result<Json<TransactionResponse>, StatusCode> {
    let transaction = transaction_repo::get_by_id(&state.pool, id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get transaction: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    // Ensure user owns this transaction
    if transaction.user_id != auth.user_id {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(Json(TransactionResponse { transaction }))
}

// ============ Get Balance ============

#[derive(Debug, Deserialize)]
pub struct BalanceQuery {
    #[serde(default = "default_currency")]
    pub currency: String,
}

fn default_currency() -> String {
    "SOL".to_string()
}

#[derive(Debug, Serialize)]
pub struct BalanceResponse {
    pub balance: i64,
    pub currency: String,
    pub pending_stakes: i64,
}

/// GET /balance
/// Get user's balance
pub async fn get_balance(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(query): Query<BalanceQuery>,
) -> Result<Json<BalanceResponse>, StatusCode> {
    let balance = transaction_repo::get_user_balance(&state.pool, auth.user_id, &query.currency)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get balance: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let pending_stakes = transaction_repo::get_pending_stakes(&state.pool, auth.user_id, &query.currency)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get pending stakes: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(BalanceResponse {
        balance,
        currency: query.currency,
        pending_stakes,
    }))
}

// ============ Commitment Transactions ============

/// GET /commitments/:id/transactions
/// List transactions for a commitment
pub async fn list_commitment_transactions(
    State(state): State<AppState>,
    Path(commitment_id): Path<Uuid>,
) -> Result<Json<ListTransactionsResponse>, StatusCode> {
    let transactions = transaction_repo::list_for_commitment(&state.pool, commitment_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list commitment transactions: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(ListTransactionsResponse { transactions }))
}
