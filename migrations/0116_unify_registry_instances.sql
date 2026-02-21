-- 0116_unify_registry_instances.sql
-- Unified Source of Truth: saas_instances

CREATE TABLE IF NOT EXISTS saas_instances (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  
  -- Domains (denormalized for speed/registry)
  trial_domain TEXT,
  custom_domain TEXT,
  domain_status TEXT NOT NULL DEFAULT 'pending',
  
  -- Plan/Economics (denormalized)
  plan_tier TEXT DEFAULT 'starter',
  plan_status TEXT DEFAULT 'active'
);

CREATE INDEX IF NOT EXISTS idx_saas_instances_slug ON saas_instances(slug);
CREATE INDEX IF NOT EXISTS idx_saas_instances_status ON saas_instances(status);

-- Migrate existing projects (Mirror)
INSERT OR IGNORE INTO saas_instances (id, tenant_id, slug, name, status, created_at, updated_at, plan_tier)
SELECT 
    id, 
    tenant_id,
    slug, 
    display_name, 
    status, 
    created_at, 
    updated_at,
    CASE 
        WHEN slug IN ('drako', 'mentoria') THEN 'enterprise' 
        ELSE 'starter' 
    END
FROM saas_projects;

-- Core Verticals Safety Net removed (handled by 0115)
