-- Add platform_type to saas_instances.
--
-- platform_type identifies the SaaS software platform that owns this instance.
-- It is used by the conversation router to dispatch inbound messages
-- (e.g. WhatsApp) to the correct domain handler.
--
-- Values are handler keys registered in the conversation-router:
--   'campamento-base'   — default, Campamento Base operator control plane
--   'mentoria'          — Mentoria education platform
--   'socialflow'        — SocialFlow social media automation
--
-- Contract is CLOSED on purpose. Adding a new SaaS platform requires a migration
-- that extends this CHECK constraint and the corresponding router handler.
--
-- DEFAULT 'campamento-base' ensures all existing records are safe.
-- New SaaS instances must set this explicitly during provisioning.

ALTER TABLE saas_instances
  ADD COLUMN platform_type TEXT NOT NULL DEFAULT 'campamento-base'
  CHECK (platform_type IN ('campamento-base', 'mentoria', 'socialflow'));
