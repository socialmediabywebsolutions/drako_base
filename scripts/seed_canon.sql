-- 1. Registry (Migration 0126 Schema: saas_slug is PK)
INSERT INTO holding_saas_registry (saas_slug, display_name, status) 
VALUES 
('drako', 'Drako SaaS Factory', 'active'),
('mentoria', 'Mentoria EdTech', 'active'),
('socialflow', 'SocialFlow Marketing', 'active')
ON CONFLICT(saas_slug) DO UPDATE SET display_name = excluded.display_name;

-- 2. Plans (Drako)
INSERT INTO saas_pricing_plans (id, saas_slug, plan_code, monthly_price_cents, limits_json, departments_json) VALUES 
('plan_drako_starter', 'drako', 'starter', 4900, '{"workspaces":1,"users":5}', '["clinic"]'),
('plan_drako_pro', 'drako', 'pro', 19900, '{"workspaces":5,"users":20}', '["clinic","nursing"]'),
('plan_drako_scale', 'drako', 'scale', 99900, '{"workspaces":20,"users":100}', '["clinic","nursing","finance"]'),

-- 3. Plans (Mentoria)
('plan_mentoria_starter', 'mentoria', 'starter', 2900, '{"students":50,"ai_calls":1000}', '["academic"]'),
('plan_mentoria_pro', 'mentoria', 'pro', 8900, '{"students":200,"ai_calls":5000}', '["academic","psychology"]'),
('plan_mentoria_scale', 'mentoria', 'scale', 29900, '{"students":1000,"ai_calls":20000}', '["academic","psychology","admin"]'),

-- 4. Plans (SocialFlow)
('plan_socialflow_starter', 'socialflow', 'starter', 1900, '{"campaigns":5,"posts":100}', '["marketing"]'),
('plan_socialflow_pro', 'socialflow', 'pro', 4900, '{"campaigns":20,"posts":1000}', '["marketing","analytics"]'),
('plan_socialflow_scale', 'socialflow', 'scale', 14900, '{"campaigns":100,"posts":10000}', '["marketing","analytics","crm"]')

ON CONFLICT(saas_slug, plan_code) DO UPDATE SET monthly_price_cents = excluded.monthly_price_cents;
