-- Commitment status enum
DO $$ BEGIN
    CREATE TYPE commitment_status AS ENUM (
        'pending',      -- created, waiting for deposits
        'locked',       -- funds locked in escrow
        'active',       -- commitment is ongoing
        'resolving',    -- awaiting settlement decision
        'released',     -- funds released to winner
        'cancelled',    -- commitment cancelled
        'expired'       -- commitment expired
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Commitments table: generic escrow commitments
CREATE TABLE IF NOT EXISTS commitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Creator (party A)
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Opponent (party B) - can be null initially for open commitments
    opponent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    opponent_wallet TEXT,  -- if opponent not yet registered
    
    -- Commitment details
    kind TEXT NOT NULL,                 -- e.g. "escrow_payment", "challenge", "order_hold"
    title TEXT,
    description TEXT,
    
    -- Financial
    amount BIGINT NOT NULL,             -- smallest unit (lamports, cents)
    currency TEXT NOT NULL DEFAULT 'SOL',
    
    -- On-chain references (optional, for Solana escrow)
    escrow_pda TEXT,
    tx_create TEXT,
    tx_deposit_creator TEXT,
    tx_deposit_opponent TEXT,
    tx_settle TEXT,
    
    -- Timing
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    
    -- Status
    status commitment_status NOT NULL DEFAULT 'pending',
    winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Metadata
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commitments_creator ON commitments(creator_id);
CREATE INDEX IF NOT EXISTS idx_commitments_opponent ON commitments(opponent_id);
CREATE INDEX IF NOT EXISTS idx_commitments_status ON commitments(status);
CREATE INDEX IF NOT EXISTS idx_commitments_kind ON commitments(kind);
