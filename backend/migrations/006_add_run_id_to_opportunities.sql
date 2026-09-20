-- Migration 006: Add run_id column to opportunities table
-- Allows linking persisted opportunities to a discovery run

ALTER TABLE opportunities
    ADD COLUMN IF NOT EXISTS run_id UUID NULL;

-- Optional: add foreign key if discovery_runs table exists
-- ALTER TABLE opportunities
--     ADD CONSTRAINT fk_opportunities_run_id
--     FOREIGN KEY (run_id) REFERENCES discovery_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_run_id ON opportunities (run_id);