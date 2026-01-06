import { NextResponse } from "next/server";
import { ensureDatabase, queryAll, run } from "@/lib/db";
import { ensureCampamentoBase } from "@/lib/campamento-base";
import { env as resolveEnv } from "@/lib/cf";
import { createSaasFromBlueprint } from "@/lib/campamento-base/saas-factory-orchestrator";
import type { SaasBlueprintDraft } from "@/lib/campamento-base/saas-factory-types";
import { withCampamentoBaseProfile } from "@/lib/campamento-base/saas-factory-helpers";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { respondDatabaseError } from "@/lib/http/errors";


type Saas = {
  id: string;
  project_id?: string | null;
  name: string;
  slug: string;
  domain: string | null;
  subdomain: string | null;
  status: string;
  project_status?: string | null;
  public_domain: string | null;
  public_subdomain: string | null;
  primary_domain?: string | null;
  domain_status: string;
  created_at: string;
  tenant_id: string;
};

type SaasProject = {
  id: string;
  tenant_id: string;
  slug: string;
  display_name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type SaasDomain = {
  id: string;
  tenant_id: string;
  saas_id: string;
  domain: string;
  is_primary: number;
  status: string;
  verification_status: string | null;
  verification_reason: string | null;
  retry_count: number;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(req: Request) {
  try {
    ensureDatabase();
    try {
      await ensureCampamentoBase();
    } catch (error) {
      console.error("SAAS_ENSURE_ERROR", error);
      throw error;
    }
    const { tenantId } = await requireTenantAccess(req);
    const [saasRows, projectRows, domainRows] = await Promise.all([
      queryAll<Saas>(
        `SELECT id, name, slug, domain, subdomain, status, public_domain, public_subdomain, domain_status, created_at, tenant_id
         FROM saas WHERE tenant_id = ? ORDER BY created_at DESC`,
        tenantId
      ),
      queryAll<SaasProject>(
        `SELECT id, tenant_id, slug, display_name, status, created_at, updated_at
         FROM saas_projects WHERE tenant_id = ? ORDER BY created_at DESC`,
        tenantId
      ),
      queryAll<SaasDomain>(
        `SELECT id, tenant_id, saas_id, domain, is_primary, status, verification_status, verification_reason, retry_count, last_checked_at, created_at, updated_at
         FROM saas_domains WHERE tenant_id = ? ORDER BY created_at DESC`,
        tenantId
      ),
    ]);

    const hasProjects = projectRows.length > 0;
    const items = hasProjects
      ? projectRows.map((project) => {
          const linkedSaas = saasRows.find((s) => s.slug === project.slug) ?? null;
          const primaryDomain = domainRows.find((d) => d.saas_id === linkedSaas?.id && d.is_primary === 1) ?? null;
          return {
            id: linkedSaas?.id ?? project.id,
            project_id: project.id,
            saas_id: linkedSaas?.id ?? null,
            name: linkedSaas?.name ?? project.display_name,
            slug: project.slug,
            domain: linkedSaas?.domain ?? null,
            subdomain: linkedSaas?.subdomain ?? null,
            status: linkedSaas?.status ?? project.status ?? "pending",
            project_status: project.status ?? null,
            public_domain: linkedSaas?.public_domain ?? null,
            public_subdomain: linkedSaas?.public_subdomain ?? null,
            primary_domain: primaryDomain?.domain ?? linkedSaas?.public_domain ?? null,
            domain_status:
              primaryDomain?.verification_status ??
              primaryDomain?.status ??
              linkedSaas?.domain_status ??
              "pending",
            created_at: project.created_at ?? linkedSaas?.created_at ?? new Date().toISOString(),
            tenant_id: project.tenant_id,
          };
        })
      : saasRows;

    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `saas_get_err_${Date.now()}`;
    console.error("SAAS_GET_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal admin error", error_code: "INTERNAL_ERROR", correlation_id: correlationId },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    ensureDatabase();
    try {
      await ensureCampamentoBase();
    } catch (error) {
      console.error("SAAS_ENSURE_ERROR", error);
      throw error;
    }
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as {
      id?: string;
      name?: string;
      domain?: string | null;
      subdomain?: string | null;
      status?: string;
      public_domain?: string | null;
      public_subdomain?: string | null;
      domain_status?: string | null;
    } | null;

    if (!body?.id) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    }

    const fields: string[] = [];
    const values: (string | null)[] = [];
    const mapping: (keyof typeof body)[] = ["name", "domain", "subdomain", "status", "public_domain", "public_subdomain", "domain_status"];
    for (const key of mapping) {
      if (typeof body[key] !== "undefined") {
        fields.push(`${key} = ?`);
        values.push((body[key] as string) ?? null);
      }
    }
    if (fields.length === 0) {
      return NextResponse.json({ ok: false, error: "no fields to update" }, { status: 400 });
    }
    values.push(body.id);
    values.push(tenantId);
    const ok = await run(`UPDATE saas SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, ...values);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "failed to update saas" }, { status: 500 });
    }
    const items = await queryAll<Saas>(
      `SELECT id, name, slug, domain, subdomain, status, public_domain, public_subdomain, domain_status, created_at, tenant_id
       FROM saas WHERE id = ? AND tenant_id = ?`,
      body.id,
      tenantId
    );
    return NextResponse.json({ ok: true, item: items[0] ?? null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `saas_patch_err_${Date.now()}`;
    console.error("SAAS_PATCH_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal admin error", error_code: "INTERNAL_ERROR", correlation_id: correlationId },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    ensureDatabase();
    await ensureCampamentoBase();
    const auth = await requireTenantAccess(req);
    const tenantId = auth.tenantId;
    const body = (await req.json().catch(() => null)) as {
      name?: string;
      slug?: string;
      domain?: string | null;
      blueprintDraft?: Partial<SaasBlueprintDraft> | null;
    } | null;

    if (body?.blueprintDraft) {
      const draft = body.blueprintDraft;
      const fallbackSlug = draft.proposedSlug ?? body.slug ?? "nuevo-saas";
      const blueprint: SaasBlueprintDraft = withCampamentoBaseProfile({
        ownerTenantId: tenantId,
        saasName: draft.saasName ?? body.name ?? "Nuevo SaaS",
        proposedSlug: fallbackSlug,
        proposedSubdomain: draft.proposedSubdomain ?? fallbackSlug,
        verticalId: draft.verticalId ?? "OTHER",
        summary: draft.summary ?? "SaaS creado con Campamento Base",
        targetAudience: draft.targetAudience ?? "Clientes del vertical",
        mainProblem: draft.mainProblem ?? "Operacion dispersa",
        mainGoal: draft.mainGoal ?? "Mejorar eficiencia",
        packsByDepartment: draft.packsByDepartment ?? {},
        initialPricing: {
          currentMonthlyPrice: draft.initialPricing?.currentMonthlyPrice ?? 0,
          estimatedVendorCostMonthly: draft.initialPricing?.estimatedVendorCostMonthly ?? null,
          recommendedMinPriceMonthly: draft.initialPricing?.recommendedMinPriceMonthly ?? null,
          recommendedTargetPriceMonthly: draft.initialPricing?.recommendedTargetPriceMonthly ?? null,
          recommendedStretchPriceMonthly: draft.initialPricing?.recommendedStretchPriceMonthly ?? null,
        },
        aiProfile: {
          tier: draft.aiProfile?.tier ?? "BALANCED",
          notes: draft.aiProfile?.notes,
        },
        knowledgeSeeds: draft.knowledgeSeeds ?? [],
        initialFeatures: draft.initialFeatures ?? [],
        interviewSummary: draft.interviewSummary ?? "",
        provisioning: draft.provisioning,
        campamentoBaseProfile: draft.campamentoBaseProfile,
      });

      const result = await createSaasFromBlueprint({
        env: resolveEnv(),
        ownerTenantId: tenantId,
        blueprint,
      });

      return NextResponse.json({
        ok: true,
        id: result.saasId,
        provisioningStatus: {
          cloudflare: result.cloudflare,
          stripe: result.stripe,
          ai: result.ai,
        },
      });
    }

    if (!body || !body.name || !body.slug) {
      return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
    }

    const id = (globalThis.crypto?.randomUUID?.() ?? `saas_${Date.now()}`);
    const domain = body.domain ?? `${body.slug}.apps.drako.systems`;
    const now = new Date().toISOString();

    const cleanup = async (records: { alertId?: string | null; provId?: string | null; projectId?: string | null; domainId?: string | null }) => {
      await run("DELETE FROM saas_agents WHERE saas_id = ? AND tenant_id = ?", id, tenantId);
      if (records.alertId) await run("DELETE FROM alerts WHERE id = ? AND tenant_id = ?", records.alertId, tenantId);
      if (records.provId) await run("DELETE FROM provisioning WHERE id = ? AND tenant_id = ?", records.provId, tenantId);
      if (records.domainId) await run("DELETE FROM saas_domains WHERE id = ? AND tenant_id = ?", records.domainId, tenantId);
      if (records.projectId) await run("DELETE FROM saas_projects WHERE id = ? AND tenant_id = ?", records.projectId, tenantId);
      await run("DELETE FROM saas WHERE id = ? AND tenant_id = ?", id, tenantId);
    };

    const createdRecords: { alertId?: string | null; provId?: string | null; projectId?: string | null; domainId?: string | null } = {};

    try {
      const ok = await run(
        "INSERT INTO saas (id, name, slug, domain, status, tenant_id, public_domain, public_subdomain, domain_status) VALUES (?, ?, ?, ?, 'inactive', ?, NULL, NULL, 'unconfigured')",
        id,
        body.name,
        body.slug,
        domain,
        tenantId
      );
      if (!ok) throw new Error("create_saas_failed");

      const projectOk = await run(
        `INSERT INTO saas_projects (id, tenant_id, slug, display_name, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'active', ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           slug = excluded.slug,
           display_name = excluded.display_name,
           status = excluded.status,
           updated_at = excluded.updated_at`,
        id,
        tenantId,
        body.slug,
        body.name,
        now,
        now,
      );
      if (!projectOk) throw new Error("saas_project_failed");
      createdRecords.projectId = id;

      const domainId = `saas_domain_${id}`;
      const domainOk = await run(
        `INSERT INTO saas_domains (id, tenant_id, saas_id, domain, is_primary, status, last_checked_at, created_at, updated_at, verification_status, verification_reason, retry_count, verification_token, last_error)
         VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, 'pending_dns', NULL, 0, ?, NULL)
         ON CONFLICT(id) DO UPDATE SET
           domain = excluded.domain,
           is_primary = excluded.is_primary,
           status = excluded.status,
           verification_status = excluded.verification_status,
           last_checked_at = excluded.last_checked_at,
           updated_at = excluded.updated_at,
           verification_token = excluded.verification_token`,
        domainId,
        tenantId,
        id,
        domain,
        now,
        now,
        now,
        `verify_${id}`,
      );
      if (!domainOk) throw new Error("saas_domain_failed");
      createdRecords.domainId = domainId;

      const alertId = globalThis.crypto?.randomUUID?.() ?? `alert_${Date.now()}`;
      const alertOk = await run(
        "INSERT INTO alerts (id, tenant_id, severity, source, message, saas_id) VALUES (?, ?, 'info', 'SaaS Creator', ?, ?)",
        alertId,
        tenantId,
        `Provisioning initiated for SaaS '${body.name}' (slug: ${body.slug}).`,
        id
      );
      if (!alertOk) throw new Error("alert_failed");
      createdRecords.alertId = alertId;

      const provId = globalThis.crypto?.randomUUID?.() ?? `prov_${Date.now()}`;
      const provOk = await run(
        "INSERT INTO provisioning (id, saas_id, tenant_id, step, status, details) VALUES (?, ?, ?, 'init', 'pending', ?)",
        provId,
        id,
        tenantId,
        `Queued provisioning for '${body.name}'`
      );
      if (!provOk) throw new Error("prov_failed");
      createdRecords.provId = provId;

      const coreAgents = await queryAll<{ id: string }>("SELECT id FROM core_agents");
      for (const agent of coreAgents) {
        const linkId = `link_${id}_${agent.id}`;
        const assigned = await run(
          "INSERT OR IGNORE INTO saas_agents (id, saas_id, tenant_id, core_agent_id, estado, config) VALUES (?, ?, ?, ?, 'activo', '{}')",
          linkId,
          id,
          tenantId,
          agent.id
        );
        if (!assigned) throw new Error("agent_clone_failed");
      }

      return NextResponse.json({ ok: true, id });
    } catch (error) {
      console.error("SAAS_CREATE_ERROR", error);
      await cleanup(createdRecords);
      const response = authErrorResponse(error);
      if (response) return response;
      const dbError = respondDatabaseError(error);
      if (dbError) return dbError;
      const correlationId = globalThis.crypto?.randomUUID?.() ?? `saas_create_err_${Date.now()}`;
      return NextResponse.json(
        { error: "No se pudo completar la creación del SaaS", error_code: "INTERNAL_ERROR", correlation_id: correlationId },
        { status: 500 }
      );
    }
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `saas_post_err_${Date.now()}`;
    console.error("SAAS_POST_ERROR", correlationId, error);
    return NextResponse.json(
      { error: "No se pudo completar la creación del SaaS", error_code: "INTERNAL_ERROR", correlation_id: correlationId },
      { status: 500 }
    );
  }
}
