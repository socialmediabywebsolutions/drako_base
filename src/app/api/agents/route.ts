import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";

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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const departmentId = url.searchParams.get("department_id");
  const sql = departmentId
    ? "SELECT id, name, department_id, provider, model, active, created_at FROM agents WHERE department_id = ? ORDER BY created_at DESC"
    : "SELECT id, name, department_id, provider, model, active, created_at FROM agents ORDER BY created_at DESC";
  const items = departmentId
    ? await queryAll<Agent>(sql, departmentId)
    : await queryAll<Agent>(sql);
  return NextResponse.json({ items, count: items.length });
}

export async function POST(req: Request) {
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
  const ok = await run(
    "INSERT INTO agents (id, name, department_id, provider, model, active) VALUES (?, ?, ?, ?, ?, ?)",
    id,
    body.name,
    body.department_id,
    body.provider ?? null,
    body.model ?? null,
    body.active === false ? 0 : 1
  );
  if (!ok) return NextResponse.json({ error: "failed to create agent" }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}
