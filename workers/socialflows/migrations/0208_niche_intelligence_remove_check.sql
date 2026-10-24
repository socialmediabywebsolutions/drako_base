-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — removes the CHECK(niche IN (...)) constraint added in
-- 0207, which hardcoded the original 10 niches. NICHE_INTELLIGENCE_NICHES in
-- NicheIntelligenceCronAgent.ts now lists 55 niches; every UPSERT for a niche
-- outside the old 10 would fail against this constraint with "CHECK constraint
-- failed". SQLite has no ALTER TABLE to drop/modify a column constraint, so the
-- table is rebuilt: rename → recreate without the CHECK → copy rows → drop old.
-- Niche validity is enforced at the application layer instead (see
-- NICHE_INTELLIGENCE_NICHES / isValidNiche in the admin refresh route).

ALTER TABLE socialcors_niche_intelligence RENAME TO socialcors_niche_intelligence_old;

CREATE TABLE IF NOT EXISTS socialcors_niche_intelligence (
  id                    TEXT PRIMARY KEY,
  niche                 TEXT NOT NULL,
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

INSERT INTO socialcors_niche_intelligence
  (id, niche, analysis_json, hashtags_json, formats_json, hooks_json, optimal_hours_json, fatigue_signals_json, created_at, updated_at, valid_until)
SELECT
  id, niche, analysis_json, hashtags_json, formats_json, hooks_json, optimal_hours_json, fatigue_signals_json, created_at, updated_at, valid_until
FROM socialcors_niche_intelligence_old;

DROP TABLE socialcors_niche_intelligence_old;

CREATE INDEX IF NOT EXISTS idx_socialcors_niche_intelligence_niche
  ON socialcors_niche_intelligence (niche, valid_until DESC);
