export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { ensureCampamentoBase } from "@/lib/campamento-base";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";


type SaasAgentRow = {
  id: string;
  saas_id: string;
  core_agent_id: string;
  estado: string;
  config: string;
  assigned_at: string;
  agent_nombre: string;
  agent_descripcion: string | null;
  agent_tipo: string;
  agent_slug: string;
  dept_id: string;
  dept_slug: string;
  dept_nombre: string;
  dept_descripcion: string | null;
  dept_es_critico: number;
};

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    await ensureCampamentoBase();
    const url = new URL(req.url);
    const saasId = url.searchParams.get("saas_id");
    if (!saasId) return NextResponse.json({ error: "saas_id requerido" }, { status: 400 });
    const items = await queryAll<SaasAgentRow>(
      `SELECT sa.id, sa.saas_id, sa.core_agent_id, sa.estado, sa.config, sa.assigned_at,
              ca.nombre AS agent_nombre, ca.descripcion AS agent_descripcion, ca.tipo AS agent_tipo, ca.slug AS agent_slug,
              cd.id AS dept_id, cd.slug AS dept_slug, cd.nombre AS dept_nombre, cd.descripcion AS dept_descripcion, cd.es_critico AS dept_es_critico
       FROM saas_agents sa
       JOIN core_agents ca ON ca.id = sa.core_agent_id
       JOIN core_departments cd ON cd.id = ca.department_id
       WHERE sa.tenant_id = ? AND sa.saas_id = ?
       ORDER BY cd.nombre, ca.nombre`,
      tenantId,
      saasId
    );
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("SAAS_AGENTS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    await ensureCampamentoBase();
    const body = (await req.json().catch(() => null)) as {
      saas_id?: string;
      core_agent_id?: string;
      estado?: string;
      config?: Record<string, unknown>;
    } | null;
    if (!body?.saas_id || !body.core_agent_id) {
      return NextResponse.json({ error: "saas_id y core_agent_id son obligatorios" }, { status: 400 });
    }
    const linkId = `link_${tenantId}_${body.saas_id}_${body.core_agent_id}`;
    const configValue = body.config ? JSON.stringify(body.config) : "{}";
    const ok = await run(
      "INSERT OR IGNORE INTO saas_agents (id, tenant_id, saas_id, core_agent_id, estado, config) VALUES (?, ?, ?, ?, ?, ?)",
      linkId,
      tenantId,
      body.saas_id,
      body.core_agent_id,
      body.estado ?? "activo",
      configValue
    );
    if (!ok) {
      return NextResponse.json({ error: "No se pudo asignar el agente" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id: linkId });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("SAAS_AGENTS_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    await ensureCampamentoBase();
    const url = new URL(req.url);
    const saasId = url.searchParams.get("saas_id");
    const coreAgentId = url.searchParams.get("core_agent_id");
    if (!saasId || !coreAgentId) {
      return NextResponse.json({ error: "saas_id y core_agent_id son obligatorios" }, { status: 400 });
    }
    const ok = await run(
      "DELETE FROM saas_agents WHERE tenant_id = ? AND saas_id = ? AND core_agent_id = ?",
      tenantId,
      saasId,
      coreAgentId
    );
    if (!ok) {
      return NextResponse.json({ error: "No se pudo desasignar el agente" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("SAAS_AGENTS_DELETE_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}
