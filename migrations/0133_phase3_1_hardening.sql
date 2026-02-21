-- 0133_phase3_1_hardening.sql
-- Job System Hardening (Fencing Tokens)

-- Add fencing token columns
ALTER TABLE provisioning_jobs ADD COLUMN lock_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE provisioning_jobs ADD COLUMN lock_owner TEXT;

-- Index for optimistic locking lookups
CREATE INDEX IF NOT EXISTS idx_jobs_lock_version ON provisioning_jobs(lock_version);

-- Optimized index for Reaper (finding stale locked jobs)
CREATE INDEX IF NOT EXISTS idx_reaper_stale_locks ON provisioning_jobs(execution_lock, lock_acquired_at);

-- Index for acquireLock performance / terminal state checks
CREATE INDEX IF NOT EXISTS idx_jobs_state_lock ON provisioning_jobs(current_state, execution_lock);
