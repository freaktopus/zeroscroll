use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct UserRow {
    pub id: Uuid,
    pub wallet_pubkey: String,
    pub wallet_label: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_login_at: DateTime<Utc>,
}

/// Find user by wallet public key
pub async fn find_by_wallet(pool: &PgPool, wallet_pubkey: &str) -> anyhow::Result<Option<UserRow>> {
    let user = sqlx::query_as::<_, UserRow>(
        r#"
        SELECT id, wallet_pubkey, wallet_label, created_at, last_login_at
        FROM users
        WHERE wallet_pubkey = $1
        "#,
    )
    .bind(wallet_pubkey)
    .fetch_optional(pool)
    .await?;
    Ok(user)
}

/// Find user by ID
pub async fn find_by_id(pool: &PgPool, user_id: Uuid) -> anyhow::Result<Option<UserRow>> {
    let user = sqlx::query_as::<_, UserRow>(
        r#"
        SELECT id, wallet_pubkey, wallet_label, created_at, last_login_at
        FROM users
        WHERE id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    Ok(user)
}

/// Create a new user
pub async fn create_user(
    pool: &PgPool,
    wallet_pubkey: &str,
    wallet_label: Option<&str>,
) -> anyhow::Result<UserRow> {
    let user = sqlx::query_as::<_, UserRow>(
        r#"
        INSERT INTO users (wallet_pubkey, wallet_label)
        VALUES ($1, $2)
        RETURNING id, wallet_pubkey, wallet_label, created_at, last_login_at
        "#,
    )
    .bind(wallet_pubkey)
    .bind(wallet_label)
    .fetch_one(pool)
    .await?;
    Ok(user)
}

/// Update last login timestamp
pub async fn update_last_login(pool: &PgPool, user_id: Uuid) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        UPDATE users SET last_login_at = now() WHERE id = $1
        "#,
    )
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Login or create: returns (is_new, user)
pub async fn login_or_create(
    pool: &PgPool,
    wallet_pubkey: &str,
    wallet_label: Option<&str>,
) -> anyhow::Result<(bool, UserRow)> {
    if let Some(user) = find_by_wallet(pool, wallet_pubkey).await? {
        update_last_login(pool, user.id).await?;
        // Refresh to get updated last_login_at
        let updated = find_by_id(pool, user.id).await?.unwrap();
        Ok((false, updated))
    } else {
        let user = create_user(pool, wallet_pubkey, wallet_label).await?;
        Ok((true, user))
    }
}

/// Get or create a user by wallet address (for system operations like app owner)
pub async fn get_or_create_by_wallet(
    pool: &PgPool,
    wallet_pubkey: &str,
) -> anyhow::Result<UserRow> {
    if let Some(user) = find_by_wallet(pool, wallet_pubkey).await? {
        Ok(user)
    } else {
        let user = create_user(pool, wallet_pubkey, Some("App Owner")).await?;
        Ok(user)
    }
}
