export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ensureDatabase, queryAll, run } from "@/lib/db";
import { ensureCampamentoBase } from "@/lib/campamento-base";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { respondDatabaseError } from "@/lib/http/errors";

type OperatorSaas = {
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

async function ensureOperatorContext() {
  ensureDatabase();
  try {
    await ensureCampamentoBase();
  } catch (error) {
    console.error("OPERATOR_SAAS_ENSURE_ERROR", error);
    throw error;
  }
}

export async function GET(req: Request) {
  try {
    await ensureOperatorContext();
    const { tenantId } = await requireTenantAccess(req);

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
      tenantId,
    );

    const mappedItems = items.map((item: any) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      status: item.status,
      domain: item.primary_domain,
      primary_domain: item.primary_domain,
      domain_status: item.verification_status ?? item.domain_status ?? "pending",
      created_at: item.created_at,
      tenant_id: item.tenant_id,
      plan_tier: item.plan_tier,
    }));

    return NextResponse.json({ items: mappedItems, count: mappedItems.length, canonical: true });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `operator_saas_get_${Date.now()}`;
    console.error("OPERATOR_SAAS_GET_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal operator error", error_code: "INTERNAL_ERROR", correlation_id: correlationId },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await ensureOperatorContext();
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

    const items = await queryAll<OperatorSaas>(
      `SELECT id, name, slug, domain, subdomain, status, public_domain, public_subdomain, domain_status, created_at, tenant_id
       FROM saas WHERE id = ? AND tenant_id = ?`,
      body.id,
      tenantId,
    );

    return NextResponse.json({ ok: true, item: items[0] ?? null, canonical: true });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `operator_saas_patch_${Date.now()}`;
    console.error("OPERATOR_SAAS_PATCH_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal operator error", error_code: "INTERNAL_ERROR", correlation_id: correlationId },
      { status: 500 },
    );
  }
}
