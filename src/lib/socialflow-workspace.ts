import { env } from "@/lib/cf";
import { LOCAL_SOCIALFLOW_SLUG } from "@/lib/socialflow-local";
import { SOCIALFLOW_SLUG } from "@/lib/factory-products/socialflow";

export type SocialFlowWorkspace = {
  id: string;
  tenant_id: string;
  slug: string;
  name: string;
  custom_domain: string | null;
  trial_domain: string | null;
  trial_ends_at?: string | null;
};

export async function findSocialFlowWorkspace(tenantId: string): Promise<SocialFlowWorkspace | null> {
  const bindings = env();
  if (!bindings?.DRACO_DB) {
    throw new Error("SocialFlow workspace requires database bindings");
  }

  const slugOptions = [LOCAL_SOCIALFLOW_SLUG, SOCIALFLOW_SLUG];
  const placeholders = slugOptions.map(() => "?").join(",");

  const query = `SELECT id, tenant_id, slug, name, custom_domain, public_domain AS trial_domain, trial_domain
    FROM saas_instances
    WHERE tenant_id = ? AND slug IN (${placeholders}) AND status IN ('active', 'trial_active')
    ORDER BY updated_at DESC
    LIMIT 1`;

  const row = await bindings.DRACO_DB.prepare(query)
    .bind(tenantId, ...slugOptions)
    .first<any>();

  if (!row) return null;

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    slug: row.slug,
    name: row.name,
    custom_domain: row.custom_domain ?? null,
    trial_domain: row.trial_domain ?? row.public_domain ?? null,
    trial_ends_at: row.trial_ends_at ?? null,
  } satisfies SocialFlowWorkspace;
}
