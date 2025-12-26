import { NextResponse } from "next/server";
import { enforcePublicEndpointPolicy } from "@/lib/security/public-endpoints";

export const runtime = "edge";

export async function GET(request: Request) {
  const blocked = await enforcePublicEndpointPolicy({ request, route: "/api/health" });
  if (blocked) return blocked;
  return NextResponse.json({ ok: true, name: "DRAKO", time: new Date().toISOString() });
}
