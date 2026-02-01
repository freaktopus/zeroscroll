use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

/// Insert a new auth nonce for challenge-response flow
pub async fn insert_nonce(
    pool: &PgPool,
    nonce: Uuid,
    wallet_pubkey: &str,
    message: &str,
    expires_at: DateTime<Utc>,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO auth_nonces (nonce, wallet_pubkey, message, expires_at)
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(nonce)
    .bind(wallet_pubkey)
    .bind(message)
    .bind(expires_at)
    .execute(pool)
    .await?;
    Ok(())
}

/// Consume (delete + return) a nonce - prevents replay attacks
/// Returns the original message if valid and not expired
pub async fn consume_nonce(
    pool: &PgPool,
    nonce: Uuid,
    wallet_pubkey: &str,
) -> anyhow::Result<Option<String>> {
    let msg = sqlx::query_scalar::<_, String>(
        r#"
        DELETE FROM auth_nonces
        WHERE nonce = $1 AND wallet_pubkey = $2 AND expires_at > now()
        RETURNING message
        "#,
    )
    .bind(nonce)
    .bind(wallet_pubkey)
    .fetch_optional(pool)
    .await?;
    Ok(msg)
}

/// Clean up expired nonces (call periodically)
pub async fn cleanup_expired(pool: &PgPool) -> anyhow::Result<u64> {
    let result = sqlx::query(
        r#"
        DELETE FROM auth_nonces WHERE expires_at < now()
        "#,
    )
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}
