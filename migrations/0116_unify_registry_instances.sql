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
INSERT INTO saas_instances (id, slug, name, status, created_at, updated_at, plan_tier)
SELECT 
    id, 
    slug, 
    display_name, 
    status, 
    created_at, 
    updated_at,
    CASE 
        WHEN slug IN ('drako', 'mentoria') THEN 'enterprise' 
        ELSE 'starter' 
    END
FROM saas_projects
WHERE NOT EXISTS (SELECT 1 FROM saas_instances WHERE slug = saas_projects.slug);

-- Ensure Core Verticals (Idempotent Safety Net)
INSERT INTO saas_instances (id, slug, name, status, created_at, plan_tier)
SELECT 'saas_drako_core', 'drako', 'Drako Systems', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'enterprise'
WHERE NOT EXISTS (SELECT 1 FROM saas_instances WHERE slug = 'drako');

INSERT INTO saas_instances (id, slug, name, status, created_at, plan_tier)
SELECT 'saas_mentoria_core', 'mentoria', 'MentorIA', 'active', strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'enterprise'
WHERE NOT EXISTS (SELECT 1 FROM saas_instances WHERE slug = 'mentoria');
