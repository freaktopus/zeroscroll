use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool, Type};
use uuid::Uuid;

/// Commitment status enum (matches DB)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "commitment_status", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum CommitmentStatus {
    Pending,
    Locked,
    Active,
    Resolving,
    Released,
    Cancelled,
    Expired,
}

impl std::fmt::Display for CommitmentStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CommitmentStatus::Pending => write!(f, "pending"),
            CommitmentStatus::Locked => write!(f, "locked"),
            CommitmentStatus::Active => write!(f, "active"),
            CommitmentStatus::Resolving => write!(f, "resolving"),
            CommitmentStatus::Released => write!(f, "released"),
            CommitmentStatus::Cancelled => write!(f, "cancelled"),
            CommitmentStatus::Expired => write!(f, "expired"),
        }
    }
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct CommitmentRow {
    pub id: Uuid,
    pub creator_id: Uuid,
    pub opponent_id: Option<Uuid>,
    pub opponent_wallet: Option<String>,
    pub kind: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub amount: i64,
    pub currency: String,
    pub escrow_pda: Option<String>,
    pub tx_create: Option<String>,
    pub tx_deposit_creator: Option<String>,
    pub tx_deposit_opponent: Option<String>,
    pub tx_settle: Option<String>,
    pub start_at: Option<DateTime<Utc>>,
    pub end_at: Option<DateTime<Utc>>,
    pub status: CommitmentStatus,
    pub winner_id: Option<Uuid>,
    pub meta: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Input for creating a commitment
#[derive(Debug, Deserialize)]
pub struct CreateCommitmentInput {
    pub opponent_id: Option<Uuid>,
    pub opponent_wallet: Option<String>,
    pub kind: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub amount: i64,
    pub currency: String,
    pub start_at: Option<DateTime<Utc>>,
    pub end_at: Option<DateTime<Utc>>,
    pub meta: Option<serde_json::Value>,
}

/// Create a new commitment
pub async fn create(
    pool: &PgPool,
    creator_id: Uuid,
    input: &CreateCommitmentInput,
) -> anyhow::Result<CommitmentRow> {
    let meta = input.meta.clone().unwrap_or(serde_json::json!({}));
    
    let row = sqlx::query_as::<_, CommitmentRow>(
        r#"
        INSERT INTO commitments (
            creator_id, opponent_id, opponent_wallet, kind, title, description,
            amount, currency, start_at, end_at, meta
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
        "#,
    )
    .bind(creator_id)
    .bind(input.opponent_id)
    .bind(&input.opponent_wallet)
    .bind(&input.kind)
    .bind(&input.title)
    .bind(&input.description)
    .bind(input.amount)
    .bind(&input.currency)
    .bind(input.start_at)
    .bind(input.end_at)
    .bind(&meta)
    .fetch_one(pool)
    .await?;
    
    Ok(row)
}

/// Get commitment by ID
pub async fn get_by_id(pool: &PgPool, id: Uuid) -> anyhow::Result<Option<CommitmentRow>> {
    let row = sqlx::query_as::<_, CommitmentRow>(
        r#"SELECT * FROM commitments WHERE id = $1"#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}

/// List commitments for a user (as creator or opponent)
pub async fn list_for_user(
    pool: &PgPool,
    user_id: Uuid,
    limit: i64,
    offset: i64,
) -> anyhow::Result<Vec<CommitmentRow>> {
    let rows = sqlx::query_as::<_, CommitmentRow>(
        r#"
        SELECT * FROM commitments
        WHERE creator_id = $1 OR opponent_id = $1
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

/// List open challenges (pending commitments looking for opponents, excluding user's own)
pub async fn list_open_challenges(
    pool: &PgPool,
    user_id: Uuid,
    limit: i64,
    offset: i64,
) -> anyhow::Result<Vec<CommitmentRow>> {
    let rows = sqlx::query_as::<_, CommitmentRow>(
        r#"
        SELECT * FROM commitments
        WHERE status = 'pending'
          AND opponent_id IS NULL
          AND creator_id != $1
          AND (opponent_wallet IS NULL OR opponent_wallet = (SELECT wallet_pubkey FROM users WHERE id = $1))
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

/// List challenges directed at a specific user (by wallet)
pub async fn list_challenges_for_user(
    pool: &PgPool,
    user_id: Uuid,
    wallet_pubkey: &str,
    limit: i64,
    offset: i64,
) -> anyhow::Result<Vec<CommitmentRow>> {
    let rows = sqlx::query_as::<_, CommitmentRow>(
        r#"
        SELECT * FROM commitments
        WHERE status = 'pending'
          AND opponent_id IS NULL
          AND creator_id != $1
          AND opponent_wallet = $2
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(user_id)
    .bind(wallet_pubkey)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Count total commitments for user
pub async fn count_for_user(pool: &PgPool, user_id: Uuid) -> anyhow::Result<i64> {
    let count: (i64,) = sqlx::query_as(
        r#"SELECT COUNT(*) as count FROM commitments WHERE creator_id = $1 OR opponent_id = $1"#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;
    Ok(count.0)
}

/// List commitments by status
pub async fn list_by_status(
    pool: &PgPool,
    status: CommitmentStatus,
    limit: i64,
    offset: i64,
) -> anyhow::Result<Vec<CommitmentRow>> {
    let rows = sqlx::query_as::<_, CommitmentRow>(
        r#"
        SELECT * FROM commitments
        WHERE status = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        "#,
    )
    .bind(status)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Update commitment status
pub async fn update_status(
    pool: &PgPool,
    id: Uuid,
    status: CommitmentStatus,
) -> anyhow::Result<CommitmentRow> {
    let row = sqlx::query_as::<_, CommitmentRow>(
        r#"
        UPDATE commitments
        SET status = $2, updated_at = now()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(status)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

/// Set opponent (accept commitment)
pub async fn set_opponent(
    pool: &PgPool,
    id: Uuid,
    opponent_id: Uuid,
) -> anyhow::Result<CommitmentRow> {
    let row = sqlx::query_as::<_, CommitmentRow>(
        r#"
        UPDATE commitments
        SET opponent_id = $2, updated_at = now()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(opponent_id)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

/// Set escrow PDA address
pub async fn set_escrow_pda(
    pool: &PgPool,
    id: Uuid,
    escrow_pda: &str,
    tx_create: Option<&str>,
) -> anyhow::Result<CommitmentRow> {
    let row = sqlx::query_as::<_, CommitmentRow>(
        r#"
        UPDATE commitments
        SET escrow_pda = $2, tx_create = $3, updated_at = now()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(escrow_pda)
    .bind(tx_create)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

/// Record creator deposit
pub async fn set_creator_deposit(
    pool: &PgPool,
    id: Uuid,
    tx_signature: &str,
) -> anyhow::Result<CommitmentRow> {
    let row = sqlx::query_as::<_, CommitmentRow>(
        r#"
        UPDATE commitments
        SET tx_deposit_creator = $2, updated_at = now()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(tx_signature)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

/// Record opponent deposit
pub async fn set_opponent_deposit(
    pool: &PgPool,
    id: Uuid,
    tx_signature: &str,
) -> anyhow::Result<CommitmentRow> {
    let row = sqlx::query_as::<_, CommitmentRow>(
        r#"
        UPDATE commitments
        SET tx_deposit_opponent = $2, updated_at = now()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(tx_signature)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

/// Settle commitment with winner
pub async fn settle(
    pool: &PgPool,
    id: Uuid,
    winner_id: Uuid,
    tx_settle: &str,
) -> anyhow::Result<CommitmentRow> {
    let row = sqlx::query_as::<_, CommitmentRow>(
        r#"
        UPDATE commitments
        SET winner_id = $2, tx_settle = $3, status = 'released', updated_at = now()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(winner_id)
    .bind(tx_settle)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

/// Cancel commitment
pub async fn cancel(pool: &PgPool, id: Uuid) -> anyhow::Result<CommitmentRow> {
    let row = sqlx::query_as::<_, CommitmentRow>(
        r#"
        UPDATE commitments
        SET status = 'cancelled', updated_at = now()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    Ok(row)
}
