import { NextResponse } from "next/server";
import { listSaasPacks } from "@/lib/packs/repository";
import { enforcePublicEndpointPolicy } from "@/lib/security/public-endpoints";


export async function GET(request: Request) {
  const blocked = await enforcePublicEndpointPolicy({ request, route: "/api/packs" });
  if (blocked) return blocked;
  return NextResponse.json({ items: listSaasPacks() });
}
