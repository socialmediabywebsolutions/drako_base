export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { env } from "@/lib/cf";
import { RevistaCronAgent } from "@/lib/revista/RevistaCronAgent";

export async function GET(request: NextRequest) {
  try {
    verifyCronAuth(request);
  } catch (error) {
    if (error instanceof CronAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bindings = env();
  if (!bindings) {
    return NextResponse.json({ ok: false, code: "ENV_UNAVAILABLE" }, { status: 503 });
  }

  try {
    const agent = new RevistaCronAgent(bindings);
    const result = await agent.run();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/revista/generate] Error", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        ok: false,
        error: "Article generation failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
