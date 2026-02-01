mod app;
mod config;
mod db;
mod domain;
mod middleware;
mod routes;
mod services;
mod utils;

use crate::config::Config;
use crate::db::pool;
use crate::routes::auth::AppState;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load configuration
    let config = Config::from_env()?;

    // Initialize tracing/logging with request visibility
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "zcrow=debug,tower_http=debug,axum=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting ZCrow backend...");

    // Connect to database
    tracing::info!("Connecting to database...");
    let db_pool = pool::create_pool(&config.database_url).await?;

    // Run migrations
    tracing::info!("Running database migrations...");
    pool::run_migrations(&db_pool).await?;

    // Create app state
    let state = AppState {
        pool: db_pool,
        jwt_secret: config.jwt_secret.clone(),
    };

    // Build router
    let app = app::make_router(state);

    // Start server
    let addr = config.bind_addr();
    tracing::info!("Server listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("Server shutdown complete");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Shutdown signal received");
}
