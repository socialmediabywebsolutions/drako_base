export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getRequestBindings } from "@/lib/db";
import { getPagesBuildStamp } from "@/lib/pages/build-stamp";

export async function GET(request: Request) {
  const correlationId = globalThis.crypto?.randomUUID?.() ?? `release_${Date.now()}`;
  const build = getPagesBuildStamp(request, correlationId, getRequestBindings());

  return NextResponse.json(
    {
      environment: build.environment.pagesEnvironment ?? build.environment.nodeEnv ?? "production",
      release_id: build.pages.buildId ?? build.gitSha,
      commit_hash: build.pages.commitSha ?? build.gitSha,
      timestamp: build.buildTime,
      worker_status: "operational",
      correlationId,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
