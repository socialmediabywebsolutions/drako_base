-- Waitlist de socialcors.com
-- Captura leads antes del lanzamiento de Mentoría, Cazh, Rentia y Health IA.
-- INSERT OR IGNORE garantiza unicidad por (email, product_interest).

CREATE TABLE IF NOT EXISTS socialcors_waitlist (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  email            TEXT    NOT NULL,
  product_interest TEXT    NOT NULL,
  profile_type     TEXT    NOT NULL DEFAULT 'otro',
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (email, product_interest)
);

CREATE INDEX IF NOT EXISTS idx_socialcors_waitlist_product
  ON socialcors_waitlist (product_interest);

CREATE INDEX IF NOT EXISTS idx_socialcors_waitlist_created
  ON socialcors_waitlist (created_at);
