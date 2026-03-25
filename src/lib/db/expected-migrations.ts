export const EXPECTED_MIGRATIONS = [
  "0045_drako_empire_runtime_core",
  "0046_drako_empire_runtime_constraints",
  "0047_drako_domain_verification",
  "0048_drako_domain_status_normalization",
  "0049_drako_stripe_mapping",
  "0050_drako_stripe_webhook_events",
  "0051_drako_events_rollups",
  "0052_drako_action_queue_operable",
  "0053_drako_public_surface_security",
  "0054_drako_ai_governance",
  "0055_drako_migrations_state",
  "0062_projects_factory_core",
  "0138_drako_automation_core",
  "0139_drako_integration_core",
  "0140_drako_observability_core",
  "0141_drako_factory_saas_registry",
] as const;

export type ExpectedMigrationId = typeof EXPECTED_MIGRATIONS[number];
