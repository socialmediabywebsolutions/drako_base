-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — Fase 1: Context Service central.
-- Adds cross-tenant niche intelligence cache, per-tenant style-learning history
-- (auto_learned_style stops being overwritten-only), and a flag to know which
-- metrics snapshots have already fed the learning loop.

-- socialcors_niche_intelligence: NOT partitioned by tenant_id/saas_id on purpose —
-- this is aggregated, anonymized intelligence shared across tenants of the same
-- niche (hashtags/formats/hooks trending this week), refreshed periodically by a
-- cron job (not part of this migration). Never store tenant-identifying data here.
CREATE TABLE IF NOT EXISTS socialcors_niche_intelligence (
  id                    TEXT PRIMARY KEY,
  niche                 TEXT NOT NULL CHECK (niche IN (
                          'fitness', 'restauracion', 'peluqueria', 'clinica_dental',
                          'educacion', 'lifestyle', 'moda', 'inmobiliaria',
                          'marketing', 'viajes'
                        )),
  analysis_json         TEXT NOT NULL DEFAULT '{}',
  hashtags_json         TEXT NOT NULL DEFAULT '[]',
  formats_json          TEXT NOT NULL DEFAULT '[]',
  hooks_json            TEXT NOT NULL DEFAULT '[]',
  optimal_hours_json    TEXT NOT NULL DEFAULT '[]',
  fatigue_signals_json  TEXT NOT NULL DEFAULT '[]',
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  valid_until           TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_socialcors_niche_intelligence_niche
  ON socialcors_niche_intelligence (niche, valid_until DESC);

-- socialcors_style_history: append-only per-tenant history of the "estilo
-- aprendido" snapshot (mirrors the auto_learned_style knowledge document at the
-- moment it was generated), so the brain can detect content fatigue instead of
-- only ever seeing the latest overwrite. Pruned to the 12 most recent rows per
-- (tenant_id, saas_id) by the application layer — see saveStyleSnapshot().
CREATE TABLE IF NOT EXISTS socialcors_style_history (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  saas_id      TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  post_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_socialcors_style_history_tenant_created
  ON socialcors_style_history (tenant_id, saas_id, created_at DESC);

-- Marks rows of socialflow_social_metrics_snapshots already consumed by a
-- learning pass, so a future performance-based learning loop doesn't reprocess
-- the same snapshot twice. Not yet read/written by any code in this phase.
ALTER TABLE socialflow_social_metrics_snapshots ADD COLUMN metrics_used INTEGER NOT NULL DEFAULT 0;
