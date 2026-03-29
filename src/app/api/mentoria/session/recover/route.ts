export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { SessionPersistenceManager } from "@/lib/mentoria/session-persistence";

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const persistence = new SessionPersistenceManager();
    
    const activeSession = await persistence.getActiveSession(actor.tenantId, actor.userId);
    
    if (!activeSession) {
      return NextResponse.json({ ok: true, activeSession: null });
    }
    
    return NextResponse.json({ ok: true, activeSession });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SESSION_RECOVERY_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : 500;
    console.error("[SessionRecoveryAPI] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const body = (await request.json()) as { sessionId: string };
    
    const persistence = new SessionPersistenceManager();
    const session = await persistence.getSessionSnapshot(actor.tenantId, body.sessionId);
    
    if (!session) {
      return NextResponse.json({ ok: false, error: "SESSION_NOT_FOUND" }, { status: 404 });
    }
    
    await persistence.resumeSession(actor.tenantId, body.sessionId);
    
    return NextResponse.json({ ok: true, session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SESSION_RESUME_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : 500;
    console.error("[SessionRecoveryAPI] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
