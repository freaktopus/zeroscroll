use chrono::{DateTime, Utc};
use serde::Serialize;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct ProfileRow {
    pub user_id: Uuid,
    pub username: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub bio: Option<String>,
    pub updated_at: DateTime<Utc>,
}

/// Ensure a profile exists for the user (create if not exists)
pub async fn ensure_profile(pool: &PgPool, user_id: Uuid) -> anyhow::Result<ProfileRow> {
    // Insert if not exists
    sqlx::query(
        r#"INSERT INTO profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING"#,
    )
    .bind(user_id)
    .execute(pool)
    .await?;

    // Return the profile
    let p = sqlx::query_as::<_, ProfileRow>(
        r#"
        SELECT user_id, username, display_name, avatar_url, bio, updated_at
        FROM profiles
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok(p)
}

/// Get profile by user ID
pub async fn get_by_user_id(pool: &PgPool, user_id: Uuid) -> anyhow::Result<Option<ProfileRow>> {
    let p = sqlx::query_as::<_, ProfileRow>(
        r#"
        SELECT user_id, username, display_name, avatar_url, bio, updated_at
        FROM profiles
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;
    Ok(p)
}

/// Get profile by username
pub async fn get_by_username(pool: &PgPool, username: &str) -> anyhow::Result<Option<ProfileRow>> {
    let p = sqlx::query_as::<_, ProfileRow>(
        r#"
        SELECT user_id, username, display_name, avatar_url, bio, updated_at
        FROM profiles
        WHERE username = $1
        "#,
    )
    .bind(username)
    .fetch_optional(pool)
    .await?;
    Ok(p)
}

/// Set username (must be unique)
pub async fn set_username(
    pool: &PgPool,
    user_id: Uuid,
    username: &str,
) -> anyhow::Result<ProfileRow> {
    let p = sqlx::query_as::<_, ProfileRow>(
        r#"
        UPDATE profiles
        SET username = $2, updated_at = now()
        WHERE user_id = $1
        RETURNING user_id, username, display_name, avatar_url, bio, updated_at
        "#,
    )
    .bind(user_id)
    .bind(username)
    .fetch_one(pool)
    .await?;
    Ok(p)
}

/// Update profile details
pub async fn update_profile(
    pool: &PgPool,
    user_id: Uuid,
    display_name: Option<&str>,
    avatar_url: Option<&str>,
    bio: Option<&str>,
) -> anyhow::Result<ProfileRow> {
    let p = sqlx::query_as::<_, ProfileRow>(
        r#"
        UPDATE profiles
        SET 
            display_name = COALESCE($2, display_name),
            avatar_url = COALESCE($3, avatar_url),
            bio = COALESCE($4, bio),
            updated_at = now()
        WHERE user_id = $1
        RETURNING user_id, username, display_name, avatar_url, bio, updated_at
        "#,
    )
    .bind(user_id)
    .bind(display_name)
    .bind(avatar_url)
    .bind(bio)
    .fetch_one(pool)
    .await?;
    Ok(p)
}

/// Check if username is available
pub async fn is_username_available(pool: &PgPool, username: &str) -> anyhow::Result<bool> {
    let count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM profiles WHERE username = $1"#,
    )
    .bind(username)
    .fetch_one(pool)
    .await?;
    Ok(count == 0)
}
