-- Seed Drako Clinic Starter SaaS template and plan
INSERT INTO saas (id, name, slug, domain, subdomain, status, created_at)
VALUES (
  'saas_drako_clinic_pack',
  'Drako Clinic Pack',
  'drako-clinic-pack',
  NULL,
  NULL,
  'active',
  COALESCE(
    (SELECT created_at FROM saas WHERE id = 'saas_drako_clinic_pack'),
    (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  )
)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  slug = excluded.slug,
  status = excluded.status;

INSERT INTO saas_plans (
  id,
  tenant_id,
  saas_id,
  plan_code,
  name,
  billing_interval,
  amount,
  currency,
  stripe_product_id,
  stripe_price_id,
  status,
  created_at,
  updated_at
)
SELECT
  'plan_drako_clinic_starter',
  'demo-tenant',
  'saas_drako_clinic_pack',
  'drako_clinic_starter',
  'Drako Clinic Starter',
  'month',
  7900,
  'EUR',
  COALESCE(
    (SELECT stripe_product_id FROM saas_plans WHERE id = 'plan_drako_clinic_starter'),
    'local_drako_clinic_product'
  ),
  COALESCE(
    (SELECT stripe_price_id FROM saas_plans WHERE id = 'plan_drako_clinic_starter'),
    'local_drako_clinic_price'
  ),
  'active',
  strftime('%Y-%m-%dT%H:%M:%fZ','now'),
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE NOT EXISTS (
  SELECT 1 FROM saas_plans WHERE tenant_id = 'demo-tenant' AND plan_code = 'drako_clinic_starter'
);
