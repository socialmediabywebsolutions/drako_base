-- Mentoría — Guardians y SaaS subscriptions
-- Crea mentoria_guardians (perfiles de padres/tutores) y saas_subscriptions
-- (tabla de suscripciones compartida, necesaria para JOINs en rutas de mentoría).

-- ─── Guardians (perfiles de padres/tutores) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS mentoria_guardians (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_guardians_tenant
  ON mentoria_guardians(tenant_id);

-- ─── SaaS Subscriptions (suscripciones por tenant y producto) ────────────────
-- Copia local en mentorias DB para JOINs; la fuente de verdad está en drako base.
CREATE TABLE IF NOT EXISTS saas_subscriptions (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  saas_slug           TEXT NOT NULL,
  plan_code           TEXT,
  status              TEXT NOT NULL DEFAULT 'trial' CHECK(status IN ('trial','active','past_due','cancelled','paused')),
  current_period_end  TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_tenant_slug
  ON saas_subscriptions(tenant_id, saas_slug);
