import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";

export const runtime = "edge";

type Grant = {
  id: string;
  title: string;
  region: string | null;
  deadline: string | null;
  budget_cents: number | null;
  requirements: string | null;
  link: string | null;
  status: string;
  created_at: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const sqlBase =
    "SELECT id, title, region, deadline, budget_cents, requirements, link, status, created_at FROM grants";
  const order = " ORDER BY created_at DESC LIMIT 200";
  const items = status
    ? await queryAll<Grant>(`${sqlBase} WHERE status = ?${order}`, status)
    : await queryAll<Grant>(`${sqlBase}${order}`);
  return NextResponse.json({ items, count: items.length });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    id?: string; // allow upsert by id if provided
    title?: string;
    region?: string | null;
    deadline?: string | null;
    budget_cents?: number | null;
    requirements?: string | null;
    link?: string | null;
    status?: string; // new, candidate, submitted, won, lost
  } | null;
  if (!body || !body.title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const id = body.id ?? (globalThis.crypto?.randomUUID?.() ?? `grant_${Date.now()}`);
  const ok = await run(
    "INSERT INTO grants (id, title, region, deadline, budget_cents, requirements, link, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, region=excluded.region, deadline=excluded.deadline, budget_cents=excluded.budget_cents, requirements=excluded.requirements, link=excluded.link, status=excluded.status",
    id,
    body.title,
    body.region ?? null,
    body.deadline ?? null,
    body.budget_cents ?? null,
    body.requirements ?? null,
    body.link ?? null,
    body.status ?? "new"
  );
  if (!ok) return NextResponse.json({ error: "failed to upsert grant" }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}
