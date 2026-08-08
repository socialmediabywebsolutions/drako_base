-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — Sprint G (TrendKeywordAgent). Marks which niche row was least
-- recently refreshed with external trend signals (YouTube/Reddit/Google Trends), so the
-- "one niche per run" cron can always pick the oldest one — NULL sorts first in SQLite's
-- default ASC order, so a niche that's never been processed is always picked before any
-- niche that has, with no CASE/COALESCE needed in the query.
ALTER TABLE socialcors_niche_intelligence ADD COLUMN trend_last_fetched TEXT;
