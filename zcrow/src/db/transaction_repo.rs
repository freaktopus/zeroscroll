use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool, Type};
use uuid::Uuid;

/// Transaction kind enum (matches DB)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "txn_kind", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum TxnKind {
    Credit,
    Debit,
    Lock,
    Release,
    Refund,
    Fee,
}

impl std::fmt::Display for TxnKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TxnKind::Credit => write!(f, "credit"),
            TxnKind::Debit => write!(f, "debit"),
            TxnKind::Lock => write!(f, "lock"),
            TxnKind::Release => write!(f, "release"),
            TxnKind::Refund => write!(f, "refund"),
            TxnKind::Fee => write!(f, "fee"),
        }
    }
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct TransactionRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub commitment_id: Option<Uuid>,
    pub kind: TxnKind,
    pub amount: i64,
    pub currency: String,
    pub tx_signature: Option<String>,
    pub ref_id: Option<String>,
    pub meta: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

/// Input for creating a transaction
#[derive(Debug, Deserialize)]
pub struct CreateTransactionInput {
    pub user_id: Uuid,
    pub commitment_id: Option<Uuid>,
    pub kind: TxnKind,
    pub amount: i64,
    pub currency: String,
    pub tx_signature: Option<String>,
    pub ref_id: Option<String>,
    pub meta: Option<serde_json::Value>,
}

/// Create a new transaction
pub async fn create(pool: &PgPool, input: &CreateTransactionInput) -> anyhow::Result<TransactionRow> {
    let meta = input.meta.clone().unwrap_or(serde_json::json!({}));
    
    let row = sqlx::query_as::<_, TransactionRow>(
        r#"
        INSERT INTO transactions (
            user_id, commitment_id, kind, amount, currency, tx_signature, ref_id, meta
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
        "#,
    )
    .bind(input.user_id)
    .bind(input.commitment_id)
    .bind(input.kind)
    .bind(input.amount)
    .bind(&input.currency)
    .bind(&input.tx_signature)
    .bind(&input.ref_id)
    .bind(&meta)
    .fetch_one(pool)
    .await?;
    
    Ok(row)
}

/// Get transaction by ID
pub async fn get_by_id(pool: &PgPool, id: Uuid) -> anyhow::Result<Option<TransactionRow>> {
    let row = sqlx::query_as::<_, TransactionRow>(
        r#"SELECT * FROM transactions WHERE id = $1"#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

/// List transactions for a user
pub async fn list_for_user(
    pool: &PgPool,
    user_id: Uuid,
    limit: i64,
    offset: i64,
) -> anyhow::Result<Vec<TransactionRow>> {
    let rows = sqlx::query_as::<_, TransactionRow>(
        r#"
        SELECT * FROM transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// List transactions for a commitment
pub async fn list_for_commitment(
    pool: &PgPool,
    commitment_id: Uuid,
) -> anyhow::Result<Vec<TransactionRow>> {
    let rows = sqlx::query_as::<_, TransactionRow>(
        r#"
        SELECT * FROM transactions
        WHERE commitment_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(commitment_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Get user balance (sum of all transactions)
pub async fn get_user_balance(pool: &PgPool, user_id: Uuid, currency: &str) -> anyhow::Result<i64> {
    // Credits and releases add, debits/locks/fees subtract
    let balance: Option<i64> = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(
            CASE 
                WHEN kind IN ('credit', 'release', 'refund') THEN amount
                WHEN kind IN ('debit', 'lock', 'fee') THEN -amount
                ELSE 0
            END
        )::BIGINT, 0)
        FROM transactions
        WHERE user_id = $1 AND currency = $2
        "#,
    )
    .bind(user_id)
    .bind(currency)
    .fetch_one(pool)
    .await?;
    
    Ok(balance.unwrap_or(0))
}

/// Get user's pending stakes (sum of locked amounts minus released)
pub async fn get_pending_stakes(pool: &PgPool, user_id: Uuid, currency: &str) -> anyhow::Result<i64> {
    // Calculate net locked amount: locks minus releases/refunds
    let pending: Option<i64> = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(
            CASE 
                WHEN kind = 'lock' THEN amount
                WHEN kind IN ('release', 'refund') THEN -amount
                ELSE 0
            END
        )::BIGINT, 0)
        FROM transactions
        WHERE user_id = $1 AND currency = $2
        "#,
    )
    .bind(user_id)
    .bind(currency)
    .fetch_one(pool)
    .await?;
    
    // Return max of 0 (no negative pending stakes)
    Ok(pending.unwrap_or(0).max(0))
}
