-- Commitment events: history/audit log of commitment state changes
CREATE TABLE IF NOT EXISTS commitment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commitment_id UUID NOT NULL REFERENCES commitments(id) ON DELETE CASCADE,
    
    -- State transition
    from_status TEXT,
    to_status TEXT NOT NULL,
    
    -- Actor (who triggered this event)
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_type TEXT,                -- 'user', 'system', 'oracle'
    
    -- Details
    note TEXT,
    meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ce_commitment ON commitment_events(commitment_id);
CREATE INDEX IF NOT EXISTS idx_ce_created ON commitment_events(created_at);
