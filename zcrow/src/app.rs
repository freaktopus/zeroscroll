use axum::{
    routing::{get, patch, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::{DefaultMakeSpan, DefaultOnRequest, DefaultOnResponse, TraceLayer};
use tracing::Level;

use crate::routes::{auth, commitments, health, leaderboard, profile, transactions};

/// Build the application router with all routes
pub fn make_router(state: auth::AppState) -> Router {
    // CORS configuration (customize for production)
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        // Health check
        .route("/health", get(health::health))
        
        // Auth routes
        .route("/auth/challenge", post(auth::challenge))
        .route("/auth/wallet", post(auth::wallet_login))
        .route("/auth/register", post(auth::register))
        
        // Profile routes (authenticated)
        .route("/me", get(profile::get_me))
        .route("/me/username", patch(profile::set_username))
        .route("/me/profile", patch(profile::update_profile))
        .route("/username/check", get(profile::check_username))
        
        // User search routes (for finding opponents)
        .route("/users/wallet/{wallet_pubkey}", get(profile::get_user_by_wallet))
        .route("/users/username/{username}", get(profile::get_user_by_username))
        
        // Commitment routes
        .route("/commitments", get(commitments::list_commitments))
        .route("/commitments", post(commitments::create_commitment))
        .route("/commitments/open", get(commitments::list_open_challenges))
        .route("/commitments/{id}", get(commitments::get_commitment))
        .route("/commitments/{id}/join", post(commitments::join_commitment))
        .route("/commitments/{id}/deposit", post(commitments::record_deposit))
        .route("/commitments/{id}/activate", post(commitments::activate_commitment))
        .route("/commitments/{id}/resolve", post(commitments::start_resolution))
        .route("/commitments/{id}/settle", post(commitments::settle_commitment))
        .route("/commitments/{id}/check-and-settle", post(commitments::check_and_settle))
        .route("/commitments/{id}/cancel", post(commitments::cancel_commitment))
        .route("/commitments/{id}/transactions", get(transactions::list_commitment_transactions))
        
        // Transaction routes
        .route("/transactions", get(transactions::list_transactions))
        .route("/transactions/{id}", get(transactions::get_transaction))
        .route("/balance", get(transactions::get_balance))
        
        // Leaderboard route
        .route("/leaderboard", get(leaderboard::get_leaderboard))
        
        // Middleware - enhanced request/response logging
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(DefaultMakeSpan::new().level(Level::INFO))
                .on_request(DefaultOnRequest::new().level(Level::INFO))
                .on_response(DefaultOnResponse::new().level(Level::INFO))
        )
        .layer(cors)
        .with_state(state)
}
