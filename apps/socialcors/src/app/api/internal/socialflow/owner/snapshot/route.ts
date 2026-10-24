import { NextResponse } from "next/server";
import {
  SOCIALCORS_CONTRACT_VERSION_HEADER,
  SOCIALCORS_INTERNAL_CONTRACT_VERSION,
  type SocialFlowOwnerSnapshotResponse,
} from "@/lib/capabilities/internal-api-types/socialflow";
import { validateInternalServiceTokenRequest } from "@/lib/capabilities/internal-api-auth/service-token";
import { env } from "@/lib/cf";
import { computeSocialCorsOwnerSnapshot } from "@/lib/socialflow/internal-api/owner-snapshot";

export const dynamic = "force-dynamic";

const CONTRACT_HEADERS = { [SOCIALCORS_CONTRACT_VERSION_HEADER]: SOCIALCORS_INTERNAL_CONTRACT_VERSION };

export async function GET(request: Request) {
  const authResult = validateInternalServiceTokenRequest(request);

  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: authResult.status, headers: CONTRACT_HEADERS });
  }

  const db = env()?.SOCIAL_DB;
  if (!db) {
    return NextResponse.json(
      { code: "INTERNAL_API_UNAVAILABLE", message: "SOCIAL_DB binding missing", requestId: authResult.requestId },
      { status: 503, headers: CONTRACT_HEADERS },
    );
  }

  const snapshot = await computeSocialCorsOwnerSnapshot(db, authResult.tenantId);

  const response: SocialFlowOwnerSnapshotResponse = {
    service: "socialflow",
    runtime: "socialcors",
    contractVersion: SOCIALCORS_INTERNAL_CONTRACT_VERSION,
    timestamp: new Date().toISOString(),
    requestId: authResult.requestId,
    tenantId: authResult.tenantId,
    snapshot,
    warnings: [],
  };

  return NextResponse.json(response, { status: 200, headers: CONTRACT_HEADERS });
}
