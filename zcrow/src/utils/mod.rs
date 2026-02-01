// Utility functions and helpers

use base64::Engine;

/// Convert base64-encoded public key (from MWA) to base58
pub fn pubkey_base64_to_base58(base64_pubkey: &str) -> anyhow::Result<String> {
    let bytes = base64::engine::general_purpose::STANDARD.decode(base64_pubkey)?;
    if bytes.len() != 32 {
        anyhow::bail!("Invalid public key length: expected 32, got {}", bytes.len());
    }
    Ok(bs58::encode(&bytes).into_string())
}

/// Validate Solana public key (base58)
pub fn is_valid_solana_pubkey(pubkey: &str) -> bool {
    if let Ok(bytes) = bs58::decode(pubkey).into_vec() {
        bytes.len() == 32
    } else {
        false
    }
}

/// Convert lamports to SOL (for display)
pub fn lamports_to_sol(lamports: i64) -> f64 {
    lamports as f64 / 1_000_000_000.0
}

/// Convert SOL to lamports
pub fn sol_to_lamports(sol: f64) -> i64 {
    (sol * 1_000_000_000.0) as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lamports_conversion() {
        assert_eq!(lamports_to_sol(1_000_000_000), 1.0);
        assert_eq!(sol_to_lamports(1.0), 1_000_000_000);
        assert_eq!(sol_to_lamports(0.5), 500_000_000);
    }

    #[test]
    fn test_pubkey_validation() {
        // Valid Solana pubkey (32 bytes when decoded)
        assert!(is_valid_solana_pubkey("11111111111111111111111111111111"));
        // Invalid
        assert!(!is_valid_solana_pubkey("invalid"));
        assert!(!is_valid_solana_pubkey(""));
    }
}
