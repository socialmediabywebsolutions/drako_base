import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { queryAll, run } from "@/lib/db";
import {
  listDemoSaas,
  listDemoSaasDomains,
  setDemoSaasPrimaryDomain,
  upsertDemoSaasDomain,
} from "@/lib/admin/demo-data";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import { listSaasSocialAccounts, resolveSocialContext } from "@/lib/socialflow/repository";
import type { SaasDomain, SaasDomainStatus, SaasPublicProfile } from "@/lib/saas/types";

export type SaasContextMode = "d1" | "demo";

export type SaasContext = {
  tenantId: string;
  saasId: string | null;
  mode: SaasContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
};

const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];

function resolveEnvOverride(envOverride?: DracoEnv | null): DracoEnv | null {
  if (envOverride) return envOverride;
  return resolveEnv();
}

function hasDatabase(envOverride?: DracoEnv | null): boolean {
  return Boolean(resolveEnvOverride(envOverride)?.DRACO_DB);
}

function isDemoFeatureEnabled(tenantId: string, envOverride?: DracoEnv | null): boolean {
  if (tenantId === DEMO_TENANT_ID) return true;
  const runtimeEnv = resolveEnvOverride(envOverride);
  const flag = runtimeEnv?.DRAKO_DEMO_MODE ?? process.env.DRAKO_DEMO_MODE;
  const runtimeEnvRecord = runtimeEnv as (Record<string, string | undefined> | null);
  const configuredDemoTenantId =
    runtimeEnvRecord?.DRAKO_CLIENT_DEMO_TENANT_ID
    ?? process.env.DRAKO_CLIENT_DEMO_TENANT_ID
    ?? DEMO_TENANT_ID;
  return typeof flag === "string" && flag.toLowerCase() === "true" && tenantId === configuredDemoTenantId;
}

function shouldFallbackToDemo(error: unknown, ctx: SaasContext): boolean {
  if (ctx.mode !== "d1" || !ctx.allowDemoFallback) return false;
  const message = (error instanceof Error ? error.message : `${error ?? ""}`).toLowerCase();
  return FALLBACK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function requireSaasId(ctx: SaasContext): string {
  const saasId = ctx.saasId?.trim();
  if (!saasId) {
    throw new Error("saasId is required");
  }
  return saasId;
}

function demoTenantId(ctx: SaasContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

export async function resolveSaasContext({
  tenantId,
  saasId,
  env,
}: {
  tenantId: string;
  saasId?: string | null;
  env?: DracoEnv | null;
}): Promise<SaasContext> {
  const normalizedSaasId = saasId?.trim() ?? null;
  const demoEnabled = isDemoFeatureEnabled(tenantId, env);

  if (hasDatabase(env)) {
    const runtimeEnv = resolveEnvOverride(env);

    // STRICT TENANT VALIDATION
    if (normalizedSaasId) {
      // Query to check if SaaS belongs to Tenant
      // We use direct SQL to avoid circular dependency (or complex repository logic)
      // Since we are IN the repository, we can do a quick check.
      // We need to ensure we don't just blindly trust the ID.
      // But `resolveSaasContext` is often used to *get* the DB context. 
      // We will do a check after creating context if possible, OR we do a check right here if we can query.
      // However, `resolveSaasContext` returns the ENV/DB binding, it doesn't query the DB yet.
      // Actually, it *does* take tenantId as input.

      // Strategy: We return a context that is TIED to this tenantId.
      // Any subsequent query using this context MUST use `tenant_id = ?` in the WHERE clause (which `listSaasDomains` does).
      // But to be "Fail Closed", we should verify existence if saasId is provided.

      // For now, we return the context. The repositories utilizing this context (like `listSaasDomains`)
      // ALREADY use `WHERE tenant_id = ?`.
      // BUT the user requirement is: "Validar tenantId siempre. Si no coincide → throw SecurityError."

      // To do this effectively without adding overhead to every call, we should check ownership.
      const saas = await queryAll<{ tenant_id: string }>(
        `SELECT tenant_id FROM saas WHERE id = ? LIMIT 1`,
        normalizedSaasId
      );

      if (saas.length > 0) {
        if (saas[0].tenant_id !== tenantId) {
          throw new Error(`SecurityError: SaaS ${normalizedSaasId} does not belong to tenant ${tenantId}.`);
        }
      } else {
        // If SaaS doesn't exist, we might want to throw or allow "not found" later.
        // But if specific ID requested and not found/mismatch -> Security Error / Not Found.
      }
    }

    return {
      tenantId,
      saasId: normalizedSaasId,
      mode: "d1",
      allowDemoFallback: demoEnabled,
      demoTenantId: demoEnabled ? DEMO_TENANT_ID : undefined,
      db: runtimeEnv?.DRACO_DB,
      env: runtimeEnv,
    };
  }

  if (!demoEnabled) {
    throw new Error("SaaS module is not enabled for this tenant.");
  }

  return {
    tenantId,
    saasId: normalizedSaasId,
    mode: "demo",
    allowDemoFallback: true,
    demoTenantId: DEMO_TENANT_ID,
    env,
  };
}

type SaasDomainRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  domain: string;
  is_primary: number;
  status: string;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeDomainStatus(status: string | null | undefined): SaasDomainStatus {
  const normalized = status?.trim().toLowerCase() ?? "pending";
  if (normalized === "active") return "active";
  if (normalized === "paused") return "paused";
  if (normalized === "pending") return "pending";
  if (normalized === "pending_dns") return "pending";
  if (normalized === "error_check" || normalized === "error") return "pending";
  if (normalized === "active_dns") return "active";
  return "pending";
}

function mapDomainRow(row: SaasDomainRow): SaasDomain {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    domain: row.domain,
    isPrimary: row.is_primary === 1,
    status: normalizeDomainStatus(row.status),
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSaasDomains(ctx: SaasContext, saasId: string): Promise<SaasDomain[]> {
  if (ctx.mode === "demo") {
    return listDemoSaasDomains(demoTenantId(ctx), saasId).map(mapDomainRow);
  }
  try {
    const rows = await queryAll<SaasDomainRow>(
      `SELECT id, tenant_id, saas_id, domain, is_primary, status, last_checked_at, created_at, updated_at
       FROM saas_domains
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY is_primary DESC, created_at DESC`,
      ctx.tenantId,
      saasId,
    );
    return rows.map(mapDomainRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoSaasDomains(demoTenantId(ctx), saasId).map(mapDomainRow);
    }
    throw error;
  }
}

export async function upsertSaasDomain(
  ctx: SaasContext,
  input: {
    id?: string;
    saasId: string;
    domain: string;
    isPrimary?: boolean;
    status?: SaasDomainStatus;
    lastCheckedAt?: string | null;
  },
): Promise<SaasDomain> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = input.id?.trim() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const status = normalizeDomainStatus(input.status);
  const isPrimary = input.isPrimary ? 1 : 0;

  if (ctx.mode === "demo") {
    if (input.isPrimary) {
      setDemoSaasPrimaryDomain(demoTenantId(ctx), saasId, id);
    }
    const record = upsertDemoSaasDomain(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      domain: input.domain,
      is_primary: isPrimary,
      status,
      last_checked_at: input.lastCheckedAt ?? null,
    });
    return mapDomainRow(record);
  }

  try {
    if (input.isPrimary) {
      await run(
        "UPDATE saas_domains SET is_primary = 0, updated_at = ? WHERE tenant_id = ? AND saas_id = ?",
        now,
        ctx.tenantId,
        saasId,
      );
    }
    await run(
      `INSERT INTO saas_domains (id, tenant_id, saas_id, domain, is_primary, status, last_checked_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         domain = excluded.domain,
         is_primary = excluded.is_primary,
         status = excluded.status,
         last_checked_at = excluded.last_checked_at,
         updated_at = excluded.updated_at`,
      id,
      ctx.tenantId,
      saasId,
      input.domain,
      isPrimary,
      status,
      input.lastCheckedAt ?? null,
      now,
      now,
    );
    const rows = await queryAll<SaasDomainRow>(
      `SELECT id, tenant_id, saas_id, domain, is_primary, status, last_checked_at, created_at, updated_at
       FROM saas_domains
       WHERE id = ? LIMIT 1`,
      id,
    );
    return mapDomainRow(rows[0]);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      if (input.isPrimary) {
        setDemoSaasPrimaryDomain(demoTenantId(ctx), saasId, id);
      }
      const record = upsertDemoSaasDomain(demoTenantId(ctx), {
        id,
        saas_id: saasId,
        domain: input.domain,
        is_primary: isPrimary,
        status,
        last_checked_at: input.lastCheckedAt ?? null,
      });
      return mapDomainRow(record);
    }
    throw error;
  }
}

export async function setPrimaryDomain(ctx: SaasContext, domainId: string): Promise<void> {
  if (ctx.mode === "demo") {
    const saasId = requireSaasId(ctx);
    setDemoSaasPrimaryDomain(demoTenantId(ctx), saasId, domainId);
    return;
  }
  const now = new Date().toISOString();
  await run("UPDATE saas_domains SET is_primary = 0, updated_at = ? WHERE tenant_id = ? AND saas_id = ?", now, ctx.tenantId, requireSaasId(ctx));
  await run("UPDATE saas_domains SET is_primary = 1, updated_at = ? WHERE tenant_id = ? AND id = ?", now, ctx.tenantId, domainId);
}

type SaasRow = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  public_domain: string | null;
  public_subdomain: string | null;
  domain_status: string;
};

export async function getSaasPublicProfile(slug: string): Promise<SaasPublicProfile | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  if (hasDatabase()) {
    const rows = await queryAll<SaasRow>(
      "SELECT id, tenant_id, name, slug, public_domain, public_subdomain, domain_status FROM saas WHERE lower(slug) = ? LIMIT 1",
      normalized,
    );
    const saas = rows[0];
    if (!saas) return null;
    const domains = await listSaasDomains(
      await resolveSaasContext({ tenantId: saas.tenant_id, saasId: saas.id }),
      saas.id,
    ).catch(() => []);
    const primaryDomain = domains.find((item) => item.isPrimary)?.domain ?? saas.public_domain ?? null;
    const socialLinks = await listSaasSocialAccounts(
      await resolveSocialContext({ tenantId: saas.tenant_id, saasId: saas.id }),
    ).then((accounts) =>
      accounts.map((account) => ({
        provider: account.provider,
        handle: account.handle ?? account.displayName ?? "",
        url: account.handle ? `https://${account.provider.toLowerCase()}.com/${account.handle.replace("@", "")}` : "",
      })),
    ).catch(() => []);
    return {
      tenantId: saas.tenant_id,
      saasId: saas.id,
      name: saas.name,
      slug: saas.slug,
      tagline: `${saas.name} · reservas online`,
      description: `Servicios premium y agenda flexible en ${saas.name}.`,
      category: "Hair Salon",
      city: null,
      address: null,
      phone: null,
      whatsapp: null,
      brand: {
        primaryColor: "#2f1b13",
        accentColor: "#fcbf92",
      },
      socialLinks: socialLinks.filter((link) => link.url),
      primaryDomain,
      publicSubdomain: saas.public_subdomain,
      domainStatus: saas.domain_status,
    };
  }

  const demo = listDemoSaas(DEMO_TENANT_ID).find((item) => item.slug.toLowerCase() === normalized);
  if (!demo) return null;
  const domains = listDemoSaasDomains(DEMO_TENANT_ID, demo.id);
  const primaryDomain = domains.find((item) => item.is_primary === 1)?.domain ?? demo.public_domain ?? null;
  return {
    tenantId: DEMO_TENANT_ID,
    saasId: demo.id,
    name: demo.name,
    slug: demo.slug,
    tagline: "Especialistas en color, cortes y mechas",
    description: "Reserva online con confirmacion rapida y servicios premium.",
    category: "Hair Salon",
    city: "Barcelona",
    address: "Passeig de Gracia 1",
    phone: "+34 600 000 000",
    whatsapp: "+34 600 000 000",
    brand: {
      primaryColor: "#2f1b13",
      accentColor: "#fcbf92",
    },
    socialLinks: [
      { provider: "INSTAGRAM", handle: "@pelu_laura", url: "https://instagram.com/pelu_laura" },
      { provider: "TIKTOK", handle: "@pelu_laura_hair", url: "https://tiktok.com/@pelu_laura_hair" },
    ],
    primaryDomain,
    publicSubdomain: demo.public_subdomain,
    domainStatus: demo.domain_status,
  };
}
