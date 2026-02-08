import { NextResponse } from "next/server";
import { ensureDatabase, queryAll, queryOne, run } from "@/lib/db";
import { respondDatabaseError } from "@/lib/http/errors";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
// export const runtime = "edge"; // OpenNext Migration


type PackRow = { id: string; tier: string; departments: string };
type AgentRow = { id: string; department_id: string };

export async function POST(req: Request) {
  try {
    ensureDatabase();
    const body = (await req.json().catch(() => null)) as { sessionId?: string; name?: string; slug?: string; packTier?: string; domain?: string | null } | null;
    if (!body?.sessionId || !body.name || !body.slug) return NextResponse.json({ error: "sessionId, name y slug requeridos" }, { status: 400 });
    const saasId = globalThis.crypto?.randomUUID?.() ?? `saas_${Date.now()}`;
    const domain = body.domain ?? `${body.slug}.drako.systems`;
    const now = new Date().toISOString();

    await run(
      "INSERT INTO saas (id, name, slug, domain, subdomain, status, tenant_id, public_domain, public_subdomain, domain_status) VALUES (?, ?, ?, ?, ?, 'inactive', ?, ?, ?, 'pending_dns')",
      saasId,
      body.name,
      body.slug,
      domain,
      body.slug,
      DEMO_TENANT_ID,
      domain,
      body.slug
    );
    await run(
      `INSERT INTO saas_instances (id, tenant_id, slug, name, status, plan_tier, created_at)
       VALUES (?, ?, ?, ?, 'active', 'basic', ?)`,
      saasId,
      DEMO_TENANT_ID,
      body.slug,
      body.name,
      now
    );
    // Legacy Mirror
    await run(
      `INSERT INTO saas_projects (id, tenant_id, slug, display_name, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`,
      saasId,
      DEMO_TENANT_ID,
      body.slug,
      body.name,
      now,
      now
    );
    await run(
      `INSERT INTO saas_domains (id, tenant_id, saas_id, domain, is_primary, status, last_checked_at, created_at, updated_at, verification_status, verification_reason, retry_count, verification_token, last_error)
       VALUES (?, ?, ?, ?, 1, 'pending', ?, ?, ?, 'pending_dns', NULL, 0, ?, NULL)
       ON CONFLICT(id) DO UPDATE SET domain = excluded.domain, status = excluded.status, last_checked_at = excluded.last_checked_at, updated_at = excluded.updated_at`,
      `saas_domain_${saasId}`,
      DEMO_TENANT_ID,
      saasId,
      domain,
      now,
      now,
      now,
      `verify_${saasId}`
    );

    const packTier = body.packTier ?? "BASIC";
    const pack = await queryOne<PackRow>("SELECT id, tier, departments FROM pack_catalog WHERE tier = ? LIMIT 1", packTier);
    const deptIds: string[] = pack ? JSON.parse(pack.departments) : [];
    const agentTemplates = await queryAll<AgentRow>("SELECT id, department_id FROM agent_catalog");
    for (const dept of deptIds) {
      const agent = agentTemplates.find((a) => a.department_id === dept);
      if (!agent) continue;
      await run(
        "INSERT INTO agent_assignments (id, saas_id, tenant_id, department_id, agent_catalog_id, pack_tier) VALUES (?, ?, ?, ?, ?, ?)",
        globalThis.crypto?.randomUUID?.() ?? `assign_${saasId}_${dept}`,
        saasId,
        DEMO_TENANT_ID,
        dept,
        agent.id,
        packTier
      );
    }

    return NextResponse.json({ ok: true, saasId, domain, packTier });
  } catch (error) {
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `provision_commit_err_${Date.now()}`;
    console.error("PROVISION_COMMIT_ERROR", correlationId, error);
    return NextResponse.json({ error: "No se pudo provisionar el SaaS", correlation_id: correlationId }, { status: 500 });
  }
}
