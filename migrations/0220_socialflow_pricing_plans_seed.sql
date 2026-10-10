-- 0220_socialflow_pricing_plans_seed.sql
-- Applies to: DRACO_DB (holding database)
-- Seeds the three canonical Socialflow plans into saas_pricing_plans.
-- Idempotent: INSERT OR IGNORE on the primary key; ON CONFLICT(saas_slug, plan_code)
-- updates mutable fields so re-running is always safe in production.
--
-- Plans:
--   starter  →  4,90 €/mes   | 32 posts/mes | 1 canal
--   basico   →  9,90 €/mes   | 48 posts/mes | 2 canales | video IA (4/mes)
--   pro      → 19,90 €/mes   | 60 posts/mes | 3 canales | video IA ilimitado | autopilot

INSERT INTO saas_pricing_plans (
  id,
  saas_slug,
  plan_code,
  monthly_price_cents,
  currency,
  departments_json,
  limits_json,
  features_json,
  is_active
) VALUES
  (
    'plan_socialflow_starter',
    'socialflow',
    'starter',
    4900,
    'eur',
    '["social"]',
    '{"posts_per_month": 32, "ai_video_enabled": false, "channels": 1}',
    '{"name": "Starter", "support": "community", "autopilot": false}',
    1
  ),
  (
    'plan_socialflow_basico',
    'socialflow',
    'basico',
    9900,
    'eur',
    '["social"]',
    '{"posts_per_month": 48, "ai_video_enabled": true, "ai_video_quota": 4, "channels": 2}',
    '{"name": "Básico", "support": "email", "autopilot": false}',
    1
  ),
  (
    'plan_socialflow_pro',
    'socialflow',
    'pro',
    19900,
    'eur',
    '["social", "analytics"]',
    '{"posts_per_month": 60, "ai_video_enabled": true, "ai_video_quota": -1, "channels": 3, "autopilot": true}',
    '{"name": "Pro", "support": "priority", "autopilot": true}',
    1
  )
ON CONFLICT(saas_slug, plan_code) DO UPDATE SET
  monthly_price_cents = excluded.monthly_price_cents,
  currency            = excluded.currency,
  departments_json    = excluded.departments_json,
  limits_json         = excluded.limits_json,
  features_json       = excluded.features_json,
  is_active           = excluded.is_active;
