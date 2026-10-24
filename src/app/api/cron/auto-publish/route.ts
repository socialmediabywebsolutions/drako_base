export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { guardCronTurn } from "@/lib/security/cron-lock";
import { requireOwnerAccess } from "@/lib/auth/session";
import { runAutoPublishAgent } from "@/lib/drako/AutoPublishAgent";

// POST /api/cron/auto-publish — genera y guarda los posts del día de @drako.systems.
// Bearer <CRON_SECRET | INTERNAL_API_SECRET>: lo llama drako-scheduler (cron
// "0 10 * * 1-5"), con lock diario contra entregas duplicadas. Sin Authorization: sesión
// de operator ("Generar ahora" en /operator/socialflow), sin lock.
export async function POST(request: NextRequest) {
  const viaCron = Boolean(request.headers.get("authorization"));
  if (viaCron) {
    try {
      verifyCronAuth(request);
    } catch (error) {
      const status = error instanceof CronAuthError ? error.status : 401;
      return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unauthorized" }, { status });
    }
    const locked = await guardCronTurn(request, "drako-auto-publish", 24 * 60);
    if (locked) return locked;
  } else {
    try {
      await requireOwnerAccess(request);
    } catch {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const { instagram, linkedin, saved, sourceArticleId } = await runAutoPublishAgent();
    console.log("[auto-publish] posts generados y guardados", { saved, sourceArticleId, viaCron });
    return NextResponse.json({ ok: true, instagram, linkedin, saved });
  } catch (error) {
    console.error("DRAKO_AUTO_PUBLISH_ERROR", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "DRAKO_AUTO_PUBLISH_FAILED" }, { status: 500 });
  }
}
