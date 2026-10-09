export const dynamic = "force-dynamic";

import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { resolveSocialFlowAuthsDb } from "@/lib/socialflow/platform/auth/repository";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const sessionId = params.id?.trim();

    if (!sessionId) {
      return json({ ok: false, error: "MISSING_SESSION_ID" }, 400);
    }

    const db = resolveSocialFlowAuthsDb();
    if (!db) {
      return json({ ok: false, error: "AUTHS_DB_UNAVAILABLE" }, 503);
    }

    // Verify the session belongs to the current user before revoking
    const existing = await db
      .prepare(
        `SELECT id FROM socialflow_sessions
         WHERE id = ? AND user_id = ? AND status = 'active'
         LIMIT 1`,
      )
      .bind(sessionId, session.userId)
      .first<{ id: string }>();

    if (!existing) {
      return json({ ok: false, error: "SESSION_NOT_FOUND" }, 404);
    }

    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE socialflow_sessions
         SET status = 'revoked', updated_at = ?
         WHERE id = ? AND user_id = ?`,
      )
      .bind(now, sessionId, session.userId)
      .run();

    return json({ ok: true, revokedSessionId: sessionId });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return json({ ok: false, error: "SESSION_REQUIRED" }, 401);
    }
    console.error("SOCIALFLOW_SESSION_REVOKE_ERROR", error);
    return json({ ok: false, error: "SESSION_REVOKE_FAILED" }, 500);
  }
}
