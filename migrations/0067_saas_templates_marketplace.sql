-- Migration: SaaS Blueprint Templates Marketplace
-- Enables one-click SaaS deployment from pre-configured templates

CREATE TABLE IF NOT EXISTS saas_blueprint_templates (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  vertical TEXT NOT NULL, -- ECOMMERCE, SAAS, EDUCATION, AGENCY, COMMUNITY, etc.
  
  -- Tier & Pricing
  tier TEXT CHECK(tier IN ('free', 'pro', 'enterprise')) DEFAULT 'free',
  price_usd REAL DEFAULT 0,
  
  -- Template configuration (JSON)
  default_entitlements_json TEXT NOT NULL, -- { packs: [], features: [], limits: {} }
  default_branding_json TEXT, -- { colors, fonts, logo placeholder }
  default_features_json TEXT, -- Enabled features list
  default_pages_json TEXT, -- Page structure/routes
  
  -- Stripe pre-configuration
  stripe_product_template_json TEXT, -- Template for Stripe product creation
  stripe_pricing_tiers_json TEXT, -- Suggested pricing tiers
  
  -- Media
  preview_image_url TEXT,
  demo_url TEXT,
  screenshots_json TEXT, -- Array of screenshot URLs
  
  -- Stats & Discovery
  installations INTEGER DEFAULT 0,
  rating REAL DEFAULT 0,
  views INTEGER DEFAULT 0,
  
  -- SEO & Marketing
  tagline TEXT,
  key_features_json TEXT, -- Marketing bullets
  target_audience TEXT,
  use_cases_json TEXT,
  
  -- Metadata
  created_by TEXT, -- tenant_id of creator (for community templates)
  is_official BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saas_template_installations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  
  -- Customizations applied
  custom_name TEXT,
  custom_domain TEXT,
  customizations_json TEXT,
  
  -- Status
  status TEXT CHECK(status IN ('deploying', 'active', 'failed')) DEFAULT 'active',
  deployment_log TEXT,
  
  installed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (saas_id) REFERENCES saas_projects(id),
  FOREIGN KEY (template_id) REFERENCES saas_blueprint_templates(id)
);

CREATE TABLE IF NOT EXISTS saas_template_reviews (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  saas_id TEXT, -- Optional: which SaaS was created from template
  
  rating INTEGER CHECK(rating BETWEEN 1 AND 5) NOT NULL,
  review_text TEXT,
  
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (template_id) REFERENCES saas_blueprint_templates(id)
);

CREATE INDEX IF NOT EXISTS idx_templates_vertical ON saas_blueprint_templates(vertical);
CREATE INDEX IF NOT EXISTS idx_templates_tier ON saas_blueprint_templates(tier);
CREATE INDEX IF NOT EXISTS idx_templates_featured ON saas_blueprint_templates(is_featured DESC, rating DESC);
CREATE INDEX IF NOT EXISTS idx_template_installations_saas ON saas_template_installations(saas_id);
CREATE INDEX IF NOT EXISTS idx_template_reviews_template ON saas_template_reviews(template_id);

-- View for template stats
CREATE VIEW IF NOT EXISTS v_template_stats AS
SELECT 
  t.id,
  t.name,
  t.slug,
  t.vertical,
  t.tier,
  t.installations,
  COALESCE(AVG(r.rating), 0) as avg_rating,
  COUNT(DISTINCT r.id) as review_count
FROM saas_blueprint_templates t
LEFT JOIN saas_template_reviews r ON r.template_id = t.id
GROUP BY t.id;
