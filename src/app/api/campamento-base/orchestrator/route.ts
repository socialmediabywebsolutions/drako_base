export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { buildCampamentoBaseSnapshot, answerQuestion } from "@/lib/campamento-base/orchestrator";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await requireOwnerAccess(request);

    const origin = new URL(request.url).origin;
    const cookie = request.headers.get("cookie") ?? undefined;

    const fetchLike = async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers ?? {});
      if (cookie) headers.set("cookie", cookie);
      return fetch(input, { ...(init ?? {}), headers, cache: "no-store" });
    };

    const snapshot = await buildCampamentoBaseSnapshot({ fetchLike, origin });

    const q = new URL(request.url).searchParams.get("q") ?? "evolución";
    const answer = answerQuestion(q, snapshot);

    return NextResponse.json({
      intent: answer.intent,
      summary: answer.summary,
      facts: answer.facts,
      evidence: answer.evidence ?? null,
      snapshotKpis: snapshot.kpis,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[campamento-base/orchestrator GET]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
