import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { ensureCampamentoBase, getCampamentoCoreDepartmentsCatalog } from "@/lib/campamento-base";
import { resolveTenantId } from "@/lib/tenants/services";
import { enforcePublicEndpointPolicy } from "@/lib/security/public-endpoints";


export type CoreDepartment = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  es_critico: number;
};

export async function GET(req: Request) {
  const tenantId = resolveTenantId(req);
  const blocked = await enforcePublicEndpointPolicy({
    request: req,
    route: "/api/core-departments",
    tenantId,
  });
  if (blocked) return blocked;
  await ensureCampamentoBase();

  let items: CoreDepartment[] = [];

  try {
    items = await queryAll<CoreDepartment>(
      "SELECT id, slug, nombre, descripcion, es_critico FROM core_departments ORDER BY nombre"
    );
  } catch (error) {
    console.error("CORE_DEPARTMENTS_DB_ERROR", error);
  }

  if (!items || items.length === 0) {
    items = getCampamentoCoreDepartmentsCatalog();
  }

  return NextResponse.json({ items, count: items.length });
}
