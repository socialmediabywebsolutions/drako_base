-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — separa la inteligencia de nicho por accountType (influencer vs
-- empresa): hasta ahora una sola fila por nicho mezclaba señales de creadores
-- individuales y de negocios locales por igual. account_type permite dos filas por
-- nicho, una por tipo de cuenta, generadas/agregadas por separado (ver
-- NicheIntelligenceCronAgent.ts y CrossTenantIntelligenceAgent.ts).
--
-- DEFAULT 'influencer' clasifica las filas existentes (una por nicho hoy) hacia ese
-- valor de forma transitoria — se autocorrige en la siguiente corrida del cron
-- semanal (o de un refresh manual), que regenera ambas filas por nicho.
--
-- No existía un índice UNIQUE sobre niche (solo idx_socialcors_niche_intelligence_niche,
-- no-único, de 0207_cerebro_phase1.sql) — la unicidad la garantizaba solo la lógica de
-- aplicación (upsertNicheIntelligence). Este índice la hace explícita a nivel de DB.
ALTER TABLE socialcors_niche_intelligence ADD COLUMN account_type TEXT NOT NULL DEFAULT 'influencer';
CREATE UNIQUE INDEX IF NOT EXISTS idx_niche_intelligence_niche_account_type ON socialcors_niche_intelligence(niche, account_type);
