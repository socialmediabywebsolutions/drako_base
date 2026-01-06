import { NextResponse } from "next/server";
import { ensureDatabase, queryOne, run } from "@/lib/db";
import { respondDatabaseError } from "@/lib/http/errors";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
export const runtime = "edge";


type SessionRow = { id: string; data_json: string };

export async function POST(req: Request) {
  try {
    ensureDatabase();
    const body = (await req.json().catch(() => null)) as { sessionId?: string; summary?: string; data?: Record<string, unknown>; sources?: string[] } | null;
    if (!body?.sessionId) return NextResponse.json({ error: "sessionId requerido" }, { status: 400 });
    const session = await queryOne<SessionRow>("SELECT id, data_json FROM onboarding_sessions WHERE id = ?", body.sessionId);
    if (!session) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
    const kbId = globalThis.crypto?.randomUUID?.() ?? `kb_${Date.now()}`;
    const dataJson = JSON.stringify(body.data ?? JSON.parse(session.data_json || "{}"));
    const summary = body.summary ?? "Resumen generado a partir de la entrevista y research demo.";
    await run(
      "INSERT INTO knowledge_bases (id, session_id, tenant_id, version, summary, data_json, sources) VALUES (?, ?, ?, ?, ?, ?, ?)",
      kbId,
      session.id,
      DEMO_TENANT_ID,
      1,
      summary,
      dataJson,
      JSON.stringify(body.sources ?? [])
    );
    return NextResponse.json({ id: kbId, summary });
  } catch (error) {
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `kb_err_${Date.now()}`;
    console.error("KB_ERROR", correlationId, error);
    return NextResponse.json({ error: "No se pudo crear la knowledge base", correlation_id: correlationId }, { status: 500 });
  }
}
