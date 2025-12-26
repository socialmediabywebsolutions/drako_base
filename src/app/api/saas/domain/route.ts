import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { queryAll, run } from "@/lib/db";

export const runtime = "edge";

type DomainRow = {
  id: string;
  tenant_id: string;
  public_domain: string | null;
  public_subdomain: string | null;
  domain_status: string;
};

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function PATCH(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const body = (await request.json().catch(() => null)) as {
      saasId?: string;
      publicDomain?: string | null;
      publicSubdomain?: string | null;
      domainStatus?: "unconfigured" | "pending_dns" | "active";
    } | null;
    if (!body?.saasId) {
      return NextResponse.json({ ok: false, error: "saasId is required" }, { status: 400 });
    }

    const rows = await queryAll<DomainRow>(
      "SELECT id, tenant_id, public_domain, public_subdomain, domain_status FROM saas WHERE id = ? AND tenant_id = ? LIMIT 1",
      body.saasId,
      tenantId,
    );
    const record = rows[0];
    if (!record) {
      return NextResponse.json({ ok: false, error: "SaaS not found" }, { status: 404 });
    }

    const nextDomain = body.publicDomain?.trim() ? body.publicDomain.trim() : null;
    const nextSubdomain = body.publicSubdomain?.trim() ? body.publicSubdomain.trim() : null;

    let nextStatus: "unconfigured" | "pending_dns" | "active" = record.domain_status as
      | "unconfigured"
      | "pending_dns"
      | "active"
      | undefined ?? "unconfigured";
    const domainChanged = nextDomain !== record.public_domain || nextSubdomain !== record.public_subdomain;
    if (domainChanged) {
      nextStatus = nextDomain || nextSubdomain ? "pending_dns" : "unconfigured";
    } else if (body.domainStatus && ["unconfigured", "pending_dns", "active"].includes(body.domainStatus)) {
      nextStatus = body.domainStatus;
    }

    const ok = await run(
      "UPDATE saas SET public_domain = ?, public_subdomain = ?, domain_status = ? WHERE id = ? AND tenant_id = ?",
      nextDomain,
      nextSubdomain,
      nextStatus,
      body.saasId,
      tenantId,
    );
    if (!ok) {
      return NextResponse.json({ ok: false, error: "Unable to update domain" }, { status: 500 });
    }

    // TODO: when integrating Cloudflare Custom Hostnames, trigger the provisioning call here.

    const updated = await queryAll<DomainRow>(
      "SELECT id, tenant_id, public_domain, public_subdomain, domain_status FROM saas WHERE id = ? AND tenant_id = ? LIMIT 1",
      body.saasId,
      tenantId,
    );
    return NextResponse.json({ ok: true, domain: updated[0] ?? null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("SAAS_DOMAIN_PATCH_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal domain update error" }, { status: 500 });
  }
}
