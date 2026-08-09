-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — SeasonalityAgent. Global cache of narrative seasonal context per
-- niche+month (not partitioned by tenant_id/saas_id, same criterion as
-- socialcors_niche_intelligence — see migration 0207 — this is shared, anonymized
-- context, never tenant-identifying data), refreshed by a nightly cron (not part of this
-- migration) with a 30-day TTL. Separate table from socialcors_niche_intelligence on
-- purpose: that table's key is `niche` alone, overwritten in-place weekly; this one needs
-- `(niche, month_key)` — 12 distinct rows per niche per year — and a much longer,
-- independent TTL, so cramming it into the same row would couple two different refresh
-- cadences on the same UPSERT.
CREATE TABLE IF NOT EXISTS socialflow_seasonality_cache (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  niche         TEXT NOT NULL,
  month_key     TEXT NOT NULL, -- "2026-08"
  context       TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  valid_until   TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_socialflow_seasonality_cache_niche_month
  ON socialflow_seasonality_cache (niche, month_key);
