import { listDemoSaas } from "@/lib/admin/demo-data";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import { SOCIALFLOW_SLUG } from "@/lib/factory-products/socialflow";

export const LOCAL_SOCIALFLOW_SLUG = "socialflow";

export function isSocialFlowInstanceSlug(slug: string | null | undefined): boolean {
  return slug === LOCAL_SOCIALFLOW_SLUG || slug === SOCIALFLOW_SLUG;
}

export function resolveClientTenantIdFromHeaders(headersList: Headers): string | null {
  const trustedTenantId = headersList.get("x-drako-tenant-id") || headersList.get("x-tenant-id");
  if (trustedTenantId) return trustedTenantId;

  const isLocalDemo = headersList.get("x-drako-client-entry-mode") === "local_demo";

  if (!isLocalDemo) return null;
  return process.env.DRAKO_CLIENT_DEMO_TENANT_ID ?? DEMO_TENANT_ID;
}

export function shouldUseLocalDemoInstance(headersList: Headers): boolean {
  return headersList.get("x-drako-client-entry-mode") === "local_demo";
}

export function buildDemoSocialFlowInstance(tenantId: string) {
  const demoSaas = listDemoSaas(tenantId).find((item) => isSocialFlowInstanceSlug(item.slug));
  if (!demoSaas) return null;

  return {
    id: demoSaas.id,
    tenant_id: tenantId,
    slug: demoSaas.slug,
    name: demoSaas.name,
    status: "active",
    plan_tier: "starter",
    custom_domain: demoSaas.domain ?? demoSaas.public_domain,
    trial_domain: demoSaas.public_domain ?? `${demoSaas.slug}.localhost`,
    trial_started_at: demoSaas.created_at,
    updated_at: demoSaas.created_at,
  };
}
