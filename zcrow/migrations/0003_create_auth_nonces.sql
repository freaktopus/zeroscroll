-- Auth nonces: for secure wallet signature challenge flow
CREATE TABLE IF NOT EXISTS auth_nonces (
    nonce UUID PRIMARY KEY,
    wallet_pubkey TEXT NOT NULL,
    message TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_nonces_wallet ON auth_nonces(wallet_pubkey);
CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires ON auth_nonces(expires_at);
