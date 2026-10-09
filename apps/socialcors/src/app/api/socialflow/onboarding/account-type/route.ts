export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { resolveAuthsDbForContext } from "@/lib/auths/repositories";

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as { accountType?: string } | null;
    const accountType = body?.accountType;

    if (accountType !== "influencer" && accountType !== "empresa") {
      return NextResponse.json({ ok: false, code: "INVALID_ACCOUNT_TYPE" }, { status: 400 });
    }

    const db = resolveAuthsDbForContext("socialflow");
    if (!db) {
      return NextResponse.json({ ok: false, code: "DB_UNAVAILABLE" }, { status: 503 });
    }

    await db
      .prepare(
        `UPDATE socialflow_users SET account_type = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
      )
      .bind(accountType, session.userId)
      .run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_ACCOUNT_TYPE_ERROR", err);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
