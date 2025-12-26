import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { env } from "@/lib/cf";

export const runtime = "edge";

type Agent = {
  id: string;
  name: string;
  department_id: string;
  provider: string | null;
  model: string | null;
  active: number;
  created_at: string;
};

const inMemoryAgents = new Map<string, Agent[]>();

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const bindings = env();

    if (!bindings || !bindings.DRACO_DB) {
      const url = new URL(req.url);
      const departmentId = url.searchParams.get("department_id");
      const tenantAgents = inMemoryAgents.get(tenantId) ?? [];
      const filtered = departmentId
        ? tenantAgents.filter((agent) => agent.department_id === departmentId)
        : tenantAgents;
      return NextResponse.json({ items: filtered, count: filtered.length });
    }

    const url = new URL(req.url);
    const departmentId = url.searchParams.get("department_id");
    const base =
      "SELECT id, name, department_id, provider, model, active, created_at FROM agents WHERE tenant_id = ?";
    const order = " ORDER BY created_at DESC";
    const items = departmentId
      ? await queryAll<Agent>(`${base} AND department_id = ?${order}`, tenantId, departmentId)
      : await queryAll<Agent>(`${base}${order}`, tenantId);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("AGENTS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as {
      name?: string;
      department_id?: string;
      provider?: string | null;
      model?: string | null;
      active?: boolean;
    } | null;
    if (!body || !body.name || !body.department_id) {
      return NextResponse.json({ error: "name and department_id are required" }, { status: 400 });
    }
    const id = globalThis.crypto?.randomUUID?.() ?? `agent_${Date.now()}`;

    const bindings = env();
    if (!bindings || !bindings.DRACO_DB) {
      const agent: Agent = {
        id,
        name: body.name,
        department_id: body.department_id,
        provider: body.provider ?? null,
        model: body.model ?? null,
        active: body.active === false ? 0 : 1,
        created_at: new Date().toISOString(),
      };
      const existing = inMemoryAgents.get(tenantId) ?? [];
      inMemoryAgents.set(tenantId, [...existing, agent]);
      return NextResponse.json({ ok: true, id });
    }

    const ok = await run(
      "INSERT INTO agents (id, tenant_id, name, department_id, provider, model, active) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id,
      tenantId,
      body.name,
      body.department_id,
      body.provider ?? null,
      body.model ?? null,
      body.active === false ? 0 : 1
    );
    if (!ok) return NextResponse.json({ error: "failed to create agent" }, { status: 500 });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("AGENTS_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}
