export const dynamic = "force-dynamic";

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

    // CERTIFIED: Single Source of Truth = saas_instances
    // We join with saas_domains to get the Primary Domain status.
    const items = await queryAll(
      `SELECT 
        si.id, 
        si.name, 
        si.slug, 
        si.status, 
        si.plan_tier, 
        si.created_at, 
        si.tenant_id,
        sd.domain as primary_domain,
        sd.verification_status,
        sd.status as domain_status
       FROM saas_instances si
       LEFT JOIN saas_domains sd ON sd.saas_id = si.id AND sd.is_primary = 1
       WHERE si.tenant_id = ? 
       ORDER BY si.created_at DESC`,
      tenantId
    );

    // Map to expected format
    const mappedItems = items.map((item: any) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      status: item.status,
      domain: item.primary_domain, // Legacy compat
      primary_domain: item.primary_domain,
      domain_status: item.verification_status ?? item.domain_status ?? "pending",
      created_at: item.created_at,
      tenant_id: item.tenant_id,
      plan_tier: item.plan_tier,
    }));

    return NextResponse.json({ items: mappedItems, count: mappedItems.length });

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

    // Handle Blueprint Creation (SaaS Factory)
    if (body?.blueprintDraft) {
      // NOTE: Blueprint creation goes through orchestrator.
      // We should ideally update orchestrator to also write to saas_instances,
      // but for Phase 11 'Create Vertical', we focus on the simple flow below.
      // Steps:
      // 1. Create via orchestrator (writes to 'saas')
      // 2. We manually sync to 'saas_instances' here to ensure registry visibility.

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

      // SYNC TO saas_instances (Registry)
      await run(
        `INSERT INTO saas_instances (id, tenant_id, name, slug, status, plan_tier, created_at)
          VALUES (?, ?, ?, ?, 'provisioning', 'trial', ?)
          ON CONFLICT(slug) DO UPDATE SET
            name = excluded.name,
            status = excluded.status,
            plan_tier = excluded.plan_tier`,
        result.saasId,
        tenantId,
        blueprint.saasName,
        blueprint.proposedSlug,
        new Date().toISOString()
      );

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

    // Handle Simple "Create Vertical"
    if (!body || !body.name || !body.slug) {
      return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
    }

    // UPSERT Logic:
    // 1. Check if slug exists in saas_instances to get stable ID.
    // 2. If not, generate new ID.
    let id = (globalThis.crypto?.randomUUID?.() ?? `saas_${Date.now()}`);
    const existing = await queryAll<{ id: string }>("SELECT id FROM saas_instances WHERE slug = ?", body.slug);
    if (existing.length > 0) {
      id = existing[0].id;
    }

    const domain = body.domain ?? `${body.slug}.apps.drako.systems`;
    const now = new Date().toISOString();

    try {
      // 1. UPSERT saas (Legacy)
      await run(
        `INSERT INTO saas (id, name, slug, domain, status, tenant_id, public_domain, public_subdomain, domain_status)
         VALUES (?, ?, ?, ?, 'inactive', ?, NULL, NULL, 'unconfigured')
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            slug = excluded.slug,
            status = excluded.status`,
        id,
        body.name,
        body.slug,
        domain,
        tenantId
      );

      // 2. UPSERT saas_instances (New Registry)
      await run(
        `INSERT INTO saas_instances (id, tenant_id, name, slug, status, plan_tier, created_at)
          VALUES (?, ?, ?, ?, 'active', 'trial', ?)
          ON CONFLICT(slug) DO UPDATE SET
            name = excluded.name,
            status = 'active', 
            plan_tier = excluded.plan_tier`,
        id,
        tenantId,
        body.name,
        body.slug,
        now
      );

      // 3. UPSERT Projects & Domains (Legacy Compat)
      await run(
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

      const domainId = `saas_domain_${id}`;
      await run(
        `INSERT INTO saas_domains (id, tenant_id, saas_id, domain, is_primary, status, last_checked_at, created_at, updated_at, verification_status, verification_reason, retry_count, verification_token, last_error)
         VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, 'pending_dns', NULL, 0, ?, NULL)
         ON CONFLICT(id) DO UPDATE SET
           domain = excluded.domain,
           updated_at = excluded.updated_at`,
        domainId,
        tenantId,
        id,
        domain,
        now,
        now,
        now,
        `verify_${id}`,
      );

      return NextResponse.json({ ok: true, id, slug: body.slug });
    } catch (error) {
      console.error("SAAS_CREATE_ERROR", error);
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
