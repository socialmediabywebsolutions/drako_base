-- Social Conversion Engine v1
-- Extends appointments attribution for social ROI.

ALTER TABLE saas_appointments ADD COLUMN social_campaign_id TEXT;
ALTER TABLE saas_appointments ADD COLUMN social_post_id TEXT;
ALTER TABLE saas_appointments ADD COLUMN source_channel TEXT;

CREATE INDEX IF NOT EXISTS idx_saas_appointments_social_campaign
  ON saas_appointments (tenant_id, saas_id, social_campaign_id);
CREATE INDEX IF NOT EXISTS idx_saas_appointments_social_post
  ON saas_appointments (tenant_id, saas_id, social_post_id);

-- TODO: If a generic leads table is added (saas_leads), extend it with social_campaign_id, social_post_id, source_channel.
