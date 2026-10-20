-- Migración 0222: Añade los plan_codes actuales de Socialcors a saas_pricing_plans.
-- Los plan_codes "starter", "basico", "pro" de la migración 0220 reflejan los
-- códigos de la época anterior al split influencer/empresa. Las suscripciones nuevas
-- (creadas desde Stripe con los precios actuales) guardan códigos como
-- "influencer_starter", "empresa_pro", etc.  Sin estas filas el JOIN en el revenue
-- route (/api/operator/revenue) devuelve COALESCE(null, 0) para todos los clientes
-- nuevos, subestimando el MRR real.
--
-- También renombra la fila legacy "pro" → conserva su precio y añade el alias
-- "influencer_pro" con el precio real actual.  Precios en céntimos de euro.

-- ── Precios actuales (catálogo 2026) ────────────────────────────────────────────

INSERT OR REPLACE INTO saas_pricing_plans
  (saas_slug, plan_code, plan_label, monthly_price_cents, is_active)
VALUES
  ('socialflow', 'influencer_starter', 'Influencer Starter',  9900, 1),
  ('socialflow', 'influencer_basico',  'Influencer Básico',   17900, 1),
  ('socialflow', 'influencer_pro',     'Influencer Pro',      29900, 1),
  ('socialflow', 'empresa_starter',    'Empresa Starter',     16900, 1),
  ('socialflow', 'empresa_basico',     'Empresa Básico',      29900, 1),
  ('socialflow', 'empresa_pro',        'Empresa Pro',         44900, 1);

-- ── Desactiva los plan_codes legacy para que no cuenten doble ───────────────────
-- "pro" normaliza a "influencer_pro" en la app, pero en DB puede haber filas con
-- el código raw.  Se marcan inactivos para excluirlos del JOIN de revenue.
UPDATE saas_pricing_plans
   SET is_active = 0
 WHERE saas_slug = 'socialflow'
   AND plan_code IN ('starter', 'basico', 'pro');
