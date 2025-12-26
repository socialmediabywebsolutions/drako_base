import { env } from "@/lib/cf";
import { queryAll } from "@/lib/db";
import { listDemoSaas, listDemoSaasServices } from "@/lib/admin/demo-data";
import { listSaasServices, resolveEconomyContext } from "@/lib/economy/repository";
import type { SaasService } from "@/lib/economy/types";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";

type SaasRow = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  public_domain: string | null;
  public_subdomain: string | null;
  domain_status: string;
};

export type PublicSaasSiteData = {
  tenantId: string;
  saasId: string;
  name: string;
  slug: string;
  publicDomain: string | null;
  publicSubdomain: string | null;
  domainStatus: string;
  services: SaasService[];
};

function hasDatabase(): boolean {
  return Boolean(env()?.DRACO_DB);
}

function safeParseMetadata(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

export async function getPublicSaasSiteData(slug: string): Promise<PublicSaasSiteData | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  if (hasDatabase()) {
    const saasRows = await queryAll<SaasRow>(
      "SELECT id, tenant_id, name, slug, public_domain, public_subdomain, domain_status FROM saas WHERE lower(slug) = ? LIMIT 1",
      normalized,
    );
    const saas = saasRows[0];
    if (!saas) return null;
    const economyCtx = await resolveEconomyContext({ tenantId: saas.tenant_id, saasId: saas.id });
    const services = await listSaasServices(economyCtx);
    return {
      tenantId: saas.tenant_id,
      saasId: saas.id,
      name: saas.name,
      slug: saas.slug,
      publicDomain: saas.public_domain,
      publicSubdomain: saas.public_subdomain,
      domainStatus: saas.domain_status,
      services,
    };
  }

  const demo = listDemoSaas(DEMO_TENANT_ID).find((item) => item.slug.toLowerCase() === normalized);
  if (!demo) return null;
  const services = listDemoSaasServices(DEMO_TENANT_ID, demo.id).map((service) => ({
    id: service.id,
    tenantId: service.tenant_id,
    saasId: service.saas_id,
    name: service.name,
    slug: service.slug,
    category: service.category,
    durationMinutes: service.duration_minutes,
    currentPrice: service.current_price,
    recommendedPrice: service.recommended_price,
    isActive: service.is_active === 1,
    metadata: safeParseMetadata(service.metadata),
    createdAt: service.created_at,
    updatedAt: service.updated_at,
  }));
  return {
    tenantId: DEMO_TENANT_ID,
    saasId: demo.id,
    name: demo.name,
    slug: demo.slug,
    publicDomain: demo.public_domain,
    publicSubdomain: demo.public_subdomain,
    domainStatus: demo.domain_status,
    services,
  };
}
