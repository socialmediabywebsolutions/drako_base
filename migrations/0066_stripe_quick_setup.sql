-- Migration: Stripe Quick Setup System
-- Enables one-click Stripe configuration for SaaS projects

CREATE TABLE IF NOT EXISTS stripe_setup_templates (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  vertical TEXT NOT NULL,
  
  -- Pricing suggestions based on market research
  suggested_monthly_price REAL,
  suggested_yearly_price REAL,
  suggested_yearly_discount REAL DEFAULT 0.17, -- 17% discount typical
  
  -- Tier suggestions (JSON array)
  suggested_tiers_json TEXT, -- [{ name, monthly, yearly, features: [] }]
  
  -- Default entitlements mapping
  default_packs_json TEXT NOT NULL,
  default_features_json TEXT NOT NULL,
  default_limits_json TEXT NOT NULL,
  
  -- Stripe product template
  stripe_product_name_template TEXT, -- "{{saas_name}} {{tier}}"
  stripe_product_description_template TEXT,
  
  -- Metadata
  description TEXT,
  market_position TEXT CHECK(market_position IN ('budget', 'mid-market', 'premium', 'enterprise')),
  target_customer TEXT, -- "SMBs", "Enterprises", "Individuals"
  
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stripe_setup_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  template_id TEXT,
  
  -- Configuration used
  config_snapshot_json TEXT NOT NULL,
  
  -- Created Stripe resources
  stripe_product_id TEXT,
  stripe_price_ids_json TEXT, -- [{ tier, monthly_id, yearly_id }]
  
  -- Status tracking
  status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'failed', 'rolled_back')) NOT NULL,
  current_step TEXT, -- "creating_product", "creating_prices", "mapping_entitlements"
  error_message TEXT,
  error_details_json TEXT,
  
  -- Timestamps
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (saas_id) REFERENCES saas_projects(id),
  FOREIGN KEY (template_id) REFERENCES stripe_setup_templates(id)
);

CREATE INDEX idx_stripe_setup_log_saas ON stripe_setup_log(saas_id);
CREATE INDEX idx_stripe_setup_log_status ON stripe_setup_log(status);
CREATE INDEX idx_stripe_setup_templates_vertical ON stripe_setup_templates(vertical);

-- Seed template: SaaS B2B Starter
INSERT INTO stripe_setup_templates (
  id, slug, name, vertical,
  suggested_monthly_price, suggested_yearly_price,
  suggested_tiers_json,
  default_packs_json, default_features_json, default_limits_json,
  stripe_product_name_template, stripe_product_description_template,
  description, market_position, target_customer
) VALUES (
  'tpl_saas_b2b_starter',
  'saas-b2b-starter',
  'SaaS B2B Starter',
  'SaaS',
  49.00,
  490.00,
  '[
    {"name":"Starter","monthly":49,"yearly":490,"features":["crm","basic_support","api_access"]},
    {"name":"Professional","monthly":99,"yearly":990,"features":["crm","social_media","priority_support","api_access","webhooks"]},
    {"name":"Enterprise","monthly":299,"yearly":2990,"features":["crm","social_media","knowledge","premium_support","api_access","webhooks","sso"]}
  ]',
  '["crm"]',
  '["customer_management","basic_reporting"]',
  '{"max_users":10,"max_contacts":1000,"api_calls_per_month":10000}',
  '{{saas_name}} - {{tier}}',
  'Professional {{tier}} plan for {{saas_name}}',
  'Perfect for B2B SaaS targeting SMBs with CRM and basic automation needs',
  'mid-market',
  'SMBs and startups'
);

-- Seed template: E-commerce Essential
INSERT INTO stripe_setup_templates (
  id, slug, name, vertical,
  suggested_monthly_price, suggested_yearly_price,
  suggested_tiers_json,
  default_packs_json, default_features_json, default_limits_json,
  stripe_product_name_template, stripe_product_description_template,
  description, market_position, target_customer
) VALUES (
  'tpl_ecommerce_essential',
  'ecommerce-essential',
  'E-commerce Essential',
  'ECOMMERCE',
  29.00,
  290.00,
  '[
    {"name":"Basic","monthly":29,"yearly":290,"features":["products","cart","checkout"]},
    {"name":"Growth","monthly":79,"yearly":790,"features":["products","cart","checkout","inventory","marketing","analytics"]},
    {"name":"Pro","monthly":199,"yearly":1990,"features":["products","cart","checkout","inventory","marketing","analytics","multi_location","api_access"]}
  ]',
  '["ecommerce"]',
  '["product_catalog","shopping_cart","payment_processing"]',
  '{"max_products":100,"max_orders_per_month":500,"storage_gb":10}',
  '{{saas_name}} {{tier}}',
  '{{tier}} e-commerce plan for {{saas_name}}',
  'Complete e-commerce solution for online stores',
  'budget',
  'Small to medium online retailers'
);

-- Seed template: Educational Platform
INSERT INTO stripe_setup_templates (
  id, slug, name, vertical,
  suggested_monthly_price, suggested_yearly_price,
  suggested_tiers_json,
  default_packs_json, default_features_json, default_limits_json,
  stripe_product_name_template, stripe_product_description_template,
  description, market_position, target_customer
) VALUES (
  'tpl_educational_platform',
  'educational-platform',
  'Educational Platform',
  'EDUCATION',
  39.00,
  390.00,
  '[
    {"name":"Teacher","monthly":39,"yearly":390,"features":["courses","students","assignments","grading"]},
    {"name":"School","monthly":149,"yearly":1490,"features":["courses","students","assignments","grading","analytics","parent_portal","api_access"]},
    {"name":"District","monthly":499,"yearly":4990,"features":["courses","students","assignments","grading","analytics","parent_portal","api_access","sso","white_label"]}
  ]',
  '["education"]',
  '["course_management","student_tracking","progress_reports"]',
  '{"max_students":50,"max_courses":20,"storage_gb":25}',
  '{{saas_name}} - {{tier}} Plan',
  'Educational platform {{tier}} plan',
  'Complete learning management solution for educators',
  'mid-market',
  'Teachers, schools and educational institutions'
);
