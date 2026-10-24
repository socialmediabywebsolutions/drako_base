-- 0039_whatsapp_identity_global_phone_index.sql
-- Improves global inbound identity resolution by phone + line hints.

CREATE INDEX IF NOT EXISTS idx_saas_whatsapp_identities_phone_global
  ON saas_whatsapp_identities (phone_number, created_at);
