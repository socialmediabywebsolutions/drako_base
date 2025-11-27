import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { ensureCampamentoBase } from "@/lib/campamento-base";

export const runtime = "edge";

export type CoreAgent = {
  id: string;
  department_id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
};

export async function GET() {
  await ensureCampamentoBase();
  const items = await queryAll<CoreAgent>(
    "SELECT id, department_id, slug, nombre, descripcion, tipo FROM core_agents ORDER BY nombre"
  );
  return NextResponse.json({ items, count: items.length });
}
