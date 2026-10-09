import { NextResponse } from "next/server";
import type { SocialFlowOwnerSnapshotResponse } from "@/lib/capabilities/internal-api-types/socialflow";
import { validateInternalServiceTokenRequest } from "@/lib/capabilities/internal-api-auth/service-token";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = validateInternalServiceTokenRequest(request);

  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: authResult.status });
  }

  const response: SocialFlowOwnerSnapshotResponse = {
    service: "socialflow",
    runtime: "monolith",
    timestamp: new Date().toISOString(),
    requestId: authResult.requestId,
    tenantId: authResult.tenantId,
    // Stable initial contract: neutral values until decoupled owner snapshot repository is wired.
    snapshot: {
      status: "ok",
      activeCampaigns: 0,
      scheduledPosts: 0,
      failedPostsLast24h: 0,
      connectedProfiles: 0,
      lastRunAt: null,
    },
    warnings: ["SOCIALFLOW_OWNER_SNAPSHOT_NEUTRAL_VALUES"],
  };

  return NextResponse.json(response, { status: 200 });
}
