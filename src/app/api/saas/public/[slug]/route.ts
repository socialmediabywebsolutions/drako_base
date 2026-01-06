import { NextResponse } from "next/server";
import { getSaasPublicProfile } from "@/lib/saas/repository";
import { enforcePublicEndpointPolicy } from "@/lib/security/public-endpoints";


type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const blocked = await enforcePublicEndpointPolicy({ request, route: "/api/saas/public/[slug]" });
    if (blocked) return blocked;
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "slug is required" }, { status: 400 });
    }
    const profile = await getSaasPublicProfile(slug);
    if (!profile) {
      return NextResponse.json({ code: "NOT_FOUND", message: "SaaS not found" }, { status: 404 });
    }
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("PUBLIC_SAAS_PROFILE_ERROR", error);
    return NextResponse.json({ code: "PUBLIC_PROFILE_ERROR", message: "No se pudo cargar el perfil publico" }, { status: 500 });
  }
}
