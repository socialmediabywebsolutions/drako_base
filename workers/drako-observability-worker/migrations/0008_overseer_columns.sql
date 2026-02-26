-- Overseer Fields for SaaS Instances
ALTER TABLE saas_instances ADD COLUMN sentiment_score INTEGER DEFAULT 50; -- 0-100 (Psychological Pulse)
ALTER TABLE saas_instances ADD COLUMN health_score INTEGER DEFAULT 100; -- 0-100 (Technical/Margin Health)
ALTER TABLE saas_instances ADD COLUMN intervention_flags TEXT; -- JSON array of flags e.g. ["high_churn_risk"]
ALTER TABLE saas_instances ADD COLUMN last_overseer_check TIMESTAMP;
