-- Transaction kind enum
DO $$ BEGIN
    CREATE TYPE txn_kind AS ENUM (
        'credit',       -- funds added to user
        'debit',        -- funds removed from user
        'lock',         -- funds locked in escrow
        'release',      -- funds released from escrow
        'refund',       -- refund to user
        'fee'           -- platform fee
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Transactions table: ledger of all financial movements
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    commitment_id UUID REFERENCES commitments(id) ON DELETE SET NULL,
    
    kind txn_kind NOT NULL,
    amount BIGINT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'SOL',
    
    -- External references
    tx_signature TEXT,              -- on-chain transaction signature
    ref_id TEXT,                    -- external reference / provider id
    
    -- Additional data
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_commitment ON transactions(commitment_id);
CREATE INDEX IF NOT EXISTS idx_tx_kind ON transactions(kind);
CREATE INDEX IF NOT EXISTS idx_tx_signature ON transactions(tx_signature);
