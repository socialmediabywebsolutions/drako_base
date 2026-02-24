export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { ensureDatabase, queryAll, run } from "@/lib/db";
import { respondDatabaseError } from "@/lib/http/errors";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import { env } from "@/lib/cf";


type JobRow = {
  id: string;
  status: string;
  payload: string;
  result: string | null;
  requires_keys_reason: string | null;
  created_at: string;
  updated_at: string;
};

export async function POST(req: Request) {
  try {
    ensureDatabase();
    const body = (await req.json().catch(() => null)) as { sessionId?: string; address?: string; radioKm?: number; industry?: string } | null;
    if (!body?.sessionId || !body.address) return NextResponse.json({ error: "sessionId y address requeridos" }, { status: 400 });
    const id = globalThis.crypto?.randomUUID?.() ?? `research_${Date.now()}`;
    const radio = body.radioKm ?? 2;
    const payload = { address: body.address, radioKm: radio, industry: body.industry ?? "general" };
    const bindings = env();
    const hasKeys = Boolean((bindings as Record<string, unknown> | null)?.GOOGLE_PLACES_API_KEY);
    const status = hasKeys ? "running" : "requires_keys";
    const result = hasKeys
      ? JSON.stringify({ competitors: [], notes: "Conectores listos: ejecuta fetch real aquí." })
      : JSON.stringify({
          competitors: [],
          demo: true,
          notes: "Faltan claves de Google/Meta. Usando informe demo y checklist de conexión.",
          checklist: ["Configurar Google Places API", "Añadir Google Business Profile", "Autorizar redes sociales"],
        });

    await run(
      "INSERT INTO research_jobs (id, session_id, tenant_id, status, payload, result, requires_keys_reason) VALUES (?, ?, ?, ?, ?, ?, ?)",
      id,
      body.sessionId,
      DEMO_TENANT_ID,
      status,
      JSON.stringify(payload),
      result,
      hasKeys ? null : "google_places_api_key_missing"
    );

    return NextResponse.json({ id, status, result: JSON.parse(result) });
  } catch (error) {
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `research_err_${Date.now()}`;
    console.error("RESEARCH_JOB_ERROR", correlationId, error);
    return NextResponse.json({ error: "No se pudo crear el research job", correlation_id: correlationId }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    ensureDatabase();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ error: "sessionId requerido" }, { status: 400 });
    const jobs = await queryAll<JobRow>(
      "SELECT id, status, payload, result, requires_keys_reason, created_at, updated_at FROM research_jobs WHERE session_id = ? ORDER BY created_at DESC",
      sessionId
    );
    return NextResponse.json({ items: jobs.map((j) => ({ ...j, payload: JSON.parse(j.payload), result: j.result ? JSON.parse(j.result) : null })) });
  } catch (error) {
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `research_get_err_${Date.now()}`;
    console.error("RESEARCH_JOB_GET_ERROR", correlationId, error);
    return NextResponse.json({ error: "No se pudo obtener research jobs", correlation_id: correlationId }, { status: 500 });
  }
}
