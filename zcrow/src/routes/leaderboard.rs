use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::routes::auth::AppState;

#[derive(Debug, Deserialize)]
pub struct LeaderboardQuery {
    #[serde(default = "default_timeframe")]
    timeframe: String, // "week", "month", or "all"
}

fn default_timeframe() -> String {
    "week".to_string()
}

#[derive(Debug, Serialize, FromRow)]
pub struct LeaderboardEntry {
    rank: i64,
    user_id: String,
    username: Option<String>,
    display_name: Option<String>,
    avatar_url: Option<String>,
    wallet_pubkey: String,
    total_wins: i64,
    total_amount_won: i64,
    win_streak: i32,
}

/// GET /leaderboard - Get top users by wins and amounts won
pub async fn get_leaderboard(
    State(state): State<AppState>,
    Query(params): Query<LeaderboardQuery>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // Calculate the time filter based on timeframe
    let time_filter = match params.timeframe.as_str() {
        "week" => "AND c.created_at >= NOW() - INTERVAL '7 days'",
        "month" => "AND c.created_at >= NOW() - INTERVAL '30 days'",
        "all" => "",
        _ => "AND c.created_at >= NOW() - INTERVAL '7 days'", // default to week
    };

    let query = format!(
        r#"
        WITH user_stats AS (
            SELECT 
                u.id as user_id,
                u.wallet_pubkey,
                p.username,
                p.display_name,
                p.avatar_url,
                COUNT(CASE WHEN c.winner_id = u.id THEN 1 END)::BIGINT as total_wins,
                COALESCE(SUM(CASE WHEN c.winner_id = u.id THEN c.amount ELSE 0 END), 0)::BIGINT as total_amount_won,
                0::INT as win_streak
            FROM users u
            LEFT JOIN profiles p ON u.id = p.user_id
            LEFT JOIN commitments c ON (u.id = c.creator_id OR u.id = c.opponent_id)
            WHERE u.id IS NOT NULL
            {}
            GROUP BY u.id, u.wallet_pubkey, p.username, p.display_name, p.avatar_url
        )
        SELECT 
            ROW_NUMBER() OVER (ORDER BY total_wins DESC, total_amount_won DESC)::BIGINT as rank,
            user_id::TEXT,
            username,
            display_name,
            avatar_url,
            wallet_pubkey,
            total_wins,
            total_amount_won,
            win_streak
        FROM user_stats
        WHERE username IS NOT NULL
        ORDER BY total_wins DESC, total_amount_won DESC
        LIMIT 50
        "#,
        time_filter
    );

    let leaderboard: Vec<LeaderboardEntry> = sqlx::query_as(&query)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch leaderboard: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to fetch leaderboard: {}", e),
            )
        })?;

    Ok(Json(leaderboard))
}
