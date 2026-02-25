import type { D1Database, KVNamespace } from "@cloudflare/workers-types";

export async function readSaasesRegistryBySlugs(database: D1Database, saasSlug: string): Promise<Record<string, unknown> | null> {
  return database
    .prepare(`SELECT saas_id, saas_slug, status_name, worker_name, domain_name FROM saases_registry WHERE saas_slug = ? LIMIT 1`)
    .bind(saasSlug)
    .first<Record<string, unknown>>();
}

export async function readProvisioningDefaults(configNamespace: KVNamespace): Promise<Record<string, unknown>> {
  const rawDefaults = await configNamespace.get("provisioning.defaults.v1", "json");
  if (rawDefaults && typeof rawDefaults === "object") {
    return rawDefaults as Record<string, unknown>;
  }

  return {
    estimated_monthly_base_major: 35,
    estimated_setup_major: 120,
    default_region: "global",
  };
}
