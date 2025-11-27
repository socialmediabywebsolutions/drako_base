import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";

export const runtime = "edge";

type Metric = {
  id: number;
  scope: string;
  token_count: number;
  ai_cost_cents: number;
  roi: number;
  captured_at: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope");
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const sqlBase = "SELECT id, scope, token_count, ai_cost_cents, roi, captured_at FROM metrics";
  const order = " ORDER BY captured_at DESC LIMIT ?";
  const items = scope
    ? await queryAll<Metric>(`${sqlBase} WHERE scope = ?${order}`, scope, limit)
    : await queryAll<Metric>(`${sqlBase}${order}`, limit);
  return NextResponse.json({ items, count: items.length });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    scope?: string;
    token_count?: number;
    ai_cost_cents?: number;
    roi?: number;
  } | null;
  if (!body || !body.scope) return NextResponse.json({ error: "scope required" }, { status: 400 });
  const ok = await run(
    "INSERT INTO metrics (scope, token_count, ai_cost_cents, roi) VALUES (?, ?, ?, ?)",
    body.scope,
    body.token_count ?? 0,
    body.ai_cost_cents ?? 0,
    body.roi ?? 0
  );
  if (!ok) return NextResponse.json({ error: "failed to insert metric" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
