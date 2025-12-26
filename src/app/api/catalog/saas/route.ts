import { NextResponse } from "next/server";
import { listSaasCatalogItems } from "@/lib/packs/repository";
import { enforcePublicEndpointPolicy } from "@/lib/security/public-endpoints";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const blocked = await enforcePublicEndpointPolicy({ request, route: "/api/catalog/saas" });
    if (blocked) return blocked;
    const url = new URL(request.url);
    const vertical = url.searchParams.get("vertical")?.trim().toUpperCase() ?? null;
    const items = listSaasCatalogItems();
    const filtered = vertical ? items.filter((item) => item.vertical === vertical) : items;
    return NextResponse.json({ items: filtered, count: filtered.length });
  } catch (error) {
    console.error("CATALOG_SAAS_GET", error);
    return NextResponse.json({ code: "CATALOG_ERROR", message: "No se pudo cargar el catálogo" }, { status: 500 });
  }
}
