import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { ensureCampamentoBase, getCampamentoCoreAgentsCatalog } from "@/lib/campamento-base";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";

export const runtime = "edge";

export type CoreAgent = {
  id: string;
  department_id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
};

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(req: Request) {
  try {
    // Asegurar que solo usuarios/autenticación válida acceden, pero sin romper fallback
    await requireTenantAccess(req);

    let items: CoreAgent[] = [];

    try {
      await ensureCampamentoBase();
      items = await queryAll<CoreAgent>(
        "SELECT id, department_id, slug, nombre, descripcion, tipo FROM core_agents ORDER BY nombre"
      );
    } catch (dbError) {
      console.error("CORE_AGENTS_DB_ERROR", dbError);
    }

    // Fallback: si D1 no está disponible o la tabla está vacía, usar catálogo en memoria
    if (!items || items.length === 0) {
      items = getCampamentoCoreAgentsCatalog();
    }

    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("CORE_AGENTS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}
