import { NextResponse } from "next/server";
import { ensureDatabase, queryOne, run } from "@/lib/db";
import { respondDatabaseError } from "@/lib/http/errors";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
export const runtime = "edge";


type SessionRow = {
  id: string;
  status: string;
  step: string;
  data_json: string;
  recommended_pack: string | null;
  radio_km: number;
  created_at: string;
  updated_at: string;
};

export async function POST(req: Request) {
  try {
    ensureDatabase();
    const body = (await req.json().catch(() => ({}))) as { sessionId?: string | null; data?: Record<string, unknown> };
    const sessionId = body.sessionId ?? (globalThis.crypto?.randomUUID?.() ?? `onb_${Date.now()}`);

    if (body.sessionId) {
      const existing = await queryOne<SessionRow>(
        "SELECT id, status, step, data_json, recommended_pack, radio_km, created_at, updated_at FROM onboarding_sessions WHERE id = ?",
        body.sessionId
      );
      if (existing) {
        return NextResponse.json({ session: { ...existing, data: JSON.parse(existing.data_json || "{}") } });
      }
    }

    const dataJson = JSON.stringify(body.data ?? {});
    await run(
      "INSERT OR REPLACE INTO onboarding_sessions (id, tenant_id, status, step, data_json, recommended_pack) VALUES (?, ?, 'in_progress', 'intro', ?, NULL)",
      sessionId,
      DEMO_TENANT_ID,
      dataJson
    );
    await run(
      "INSERT INTO onboarding_messages (id, session_id, sender, content) VALUES (?, ?, 'system', ?)",
      globalThis.crypto?.randomUUID?.() ?? `msg_${Date.now()}`,
      sessionId,
      "Hola, soy tu orquestador. Te acompañaré en todo el proceso. Empecemos con tu negocio."
    );
    return NextResponse.json({ session: { id: sessionId, status: "in_progress", step: "intro", data: body.data ?? {} } });
  } catch (error) {
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `onb_session_err_${Date.now()}`;
    console.error("ONBOARDING_SESSION_ERROR", correlationId, error);
    return NextResponse.json({ error: "No se pudo iniciar la sesión de onboarding", correlation_id: correlationId }, { status: 500 });
  }
}
