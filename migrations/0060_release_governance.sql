-- Release Governance Table
CREATE TABLE IF NOT EXISTS saas_release_events (
    id TEXT PRIMARY KEY, -- UUID
    release_id TEXT NOT NULL, -- UUID for the deployment batch
    commit_hash TEXT NOT NULL,
    environment TEXT NOT NULL, -- 'preview', 'staging', 'production'
    actor TEXT NOT NULL,
    status TEXT NOT NULL, -- 'pending', 'success', 'failure'
    metadata TEXT, -- JSON structure for extra details
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_release_events_env_created ON saas_release_events(environment, created_at DESC);
