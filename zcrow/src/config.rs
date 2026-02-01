use std::env;

/// App owner wallet address - receives forfeited solo stakes
pub const APP_OWNER_WALLET: &str = "Bnne37SwhZH2tn3MC3fx6B5ZKWRWTfzFFPw8c8Tg5ixc";

/// Application configuration loaded from environment variables
#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub host: String,
    pub port: u16,
    pub rust_log: String,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self, ConfigError> {
        // Load .env file if present
        dotenvy::dotenv().ok();

        let database_url = env::var("DATABASE_URL")
            .map_err(|_| ConfigError::MissingEnv("DATABASE_URL"))?;
        
        let jwt_secret = env::var("JWT_SECRET")
            .map_err(|_| ConfigError::MissingEnv("JWT_SECRET"))?;

        // Validate JWT secret length
        if jwt_secret.len() < 32 {
            return Err(ConfigError::InvalidValue(
                "JWT_SECRET must be at least 32 characters",
            ));
        }

        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        
        let port = env::var("PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse()
            .map_err(|_| ConfigError::InvalidValue("PORT must be a valid number"))?;

        let rust_log = env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());

        Ok(Config {
            database_url,
            jwt_secret,
            host,
            port,
            rust_log,
        })
    }

    /// Get the server bind address
    pub fn bind_addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("Missing environment variable: {0}")]
    MissingEnv(&'static str),
    #[error("Invalid configuration value: {0}")]
    InvalidValue(&'static str),
}
