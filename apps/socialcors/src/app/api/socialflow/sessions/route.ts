export const dynamic = "force-dynamic";

import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { resolveSocialFlowAuthsDb } from "@/lib/socialflow/platform/auth/repository";

type SessionRow = {
  id: string;
  issued_at: string;
  expires_at: string;
  status: string;
  created_at: string;
  updated_at: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);

    const db = resolveSocialFlowAuthsDb();
    if (!db) {
      return json({ ok: false, error: "AUTHS_DB_UNAVAILABLE" }, 503);
    }

    const { results } = await db
      .prepare(
        `SELECT id, issued_at, expires_at, status, created_at, updated_at
         FROM socialflow_sessions
         WHERE user_id = ? AND status = 'active' AND expires_at > ?
         ORDER BY issued_at DESC
         LIMIT 50`,
      )
      .bind(session.userId, new Date().toISOString())
      .all<SessionRow>();

    return json({ ok: true, sessions: results ?? [] });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return json({ ok: false, error: "SESSION_REQUIRED" }, 401);
    }
    console.error("SOCIALFLOW_SESSIONS_LIST_ERROR", error);
    return json({ ok: false, error: "SESSIONS_LIST_FAILED" }, 500);
  }
}
