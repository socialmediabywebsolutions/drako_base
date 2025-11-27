import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";

export const runtime = "edge";

type Alert = {
  id: string;
  severity: string;
  source: string;
  message: string;
  saas_id?: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const saasId = url.searchParams.get("saas_id");
  const base = "SELECT id, severity, source, message, created_at, saas_id FROM alerts";
  const order = " ORDER BY created_at DESC LIMIT 200";
  const items = saasId
    ? await queryAll<Alert>(`${base} WHERE saas_id = ?${order}`, saasId)
    : await queryAll<Alert>(`${base}${order}`);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    severity?: string;
    source?: string;
    message?: string;
    saas_id?: string | null;
  } | null;
  if (!body || !body.severity || !body.source || !body.message) {
    return NextResponse.json({ error: "severity, source, message required" }, { status: 400 });
  }
  const id = globalThis.crypto?.randomUUID?.() ?? `alert_${Date.now()}`;
  const ok = await run(
    "INSERT INTO alerts (id, severity, source, message, saas_id) VALUES (?, ?, ?, ?, ?)",
    id,
    body.severity,
    body.source,
    body.message,
    body.saas_id ?? null
  );
  if (!ok) return NextResponse.json({ error: "failed to create alert" }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}
