import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { ensureCampamentoBase } from "@/lib/campamento-base";
import { env as resolveEnv } from "@/lib/cf";
import { createSaasFromBlueprint } from "@/lib/campamento-base/saas-factory-orchestrator";
import type { SaasBlueprintDraft } from "@/lib/campamento-base/saas-factory-types";
import { withCampamentoBaseProfile } from "@/lib/campamento-base/saas-factory-helpers";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";

export const runtime = "edge";

type Saas = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  subdomain: string | null;
  status: string;
  public_domain: string | null;
  public_subdomain: string | null;
  domain_status: string;
  created_at: string;
  tenant_id: string;
};

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(req: Request) {
  try {
    await ensureCampamentoBase();
    const { tenantId } = await requireTenantAccess(req);
    const items = await queryAll<Saas>(
      `SELECT id, name, slug, domain, subdomain, status, public_domain, public_subdomain, domain_status, created_at, tenant_id
       FROM saas WHERE tenant_id = ? ORDER BY created_at DESC`,
      tenantId
    );
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("SAAS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await ensureCampamentoBase();
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
    console.error("SAAS_PATCH_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
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
  const domain = body.domain ?? null;

  const cleanup = async (records: { alertId?: string | null; provId?: string | null }) => {
    await run("DELETE FROM saas_agents WHERE saas_id = ? AND tenant_id = ?", id, tenantId);
    if (records.alertId) await run("DELETE FROM alerts WHERE id = ? AND tenant_id = ?", records.alertId, tenantId);
    if (records.provId) await run("DELETE FROM provisioning WHERE id = ? AND tenant_id = ?", records.provId, tenantId);
    await run("DELETE FROM saas WHERE id = ? AND tenant_id = ?", id, tenantId);
  };

  const createdRecords: { alertId?: string | null; provId?: string | null } = {};

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
    return NextResponse.json({ error: "No se pudo completar la creación del SaaS" }, { status: 500 });
  }
}
