-- 0052_drako_action_queue_operable.sql
-- Add operability fields for action queue + normalize status.

ALTER TABLE campamento_actions ADD COLUMN saas_slug TEXT;
ALTER TABLE campamento_actions ADD COLUMN summary TEXT;
ALTER TABLE campamento_actions ADD COLUMN action_key TEXT;
ALTER TABLE campamento_actions ADD COLUMN last_seen_at TEXT;
ALTER TABLE campamento_actions ADD COLUMN seen_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE campamento_actions ADD COLUMN correlation_id TEXT;

UPDATE campamento_actions
SET status = CASE
  WHEN status IN ('NEW', 'IN_PROGRESS') THEN 'OPEN'
  WHEN status = 'DONE' THEN 'EXECUTED'
  WHEN status = 'DISMISSED' THEN 'DISMISSED'
  WHEN status = 'SNOOZED' THEN 'SNOOZED'
  ELSE 'OPEN'
END
WHERE status IS NOT NULL;

UPDATE campamento_actions
SET summary = COALESCE(summary, description)
WHERE summary IS NULL;

UPDATE campamento_actions
SET action_key = COALESCE(action_key, lower(category || ':' || COALESCE(saas_id, 'global') || ':' || title))
WHERE action_key IS NULL;

UPDATE campamento_actions
SET last_seen_at = COALESCE(last_seen_at, created_at)
WHERE last_seen_at IS NULL;

UPDATE campamento_actions
SET seen_count = COALESCE(seen_count, 1)
WHERE seen_count IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campamento_actions_action_key_status
  ON campamento_actions (tenant_id, action_key, status);

CREATE INDEX IF NOT EXISTS idx_campamento_actions_open_priority
  ON campamento_actions (tenant_id, status, priority, last_seen_at);
