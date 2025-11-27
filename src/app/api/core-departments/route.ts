import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { ensureCampamentoBase } from "@/lib/campamento-base";

export const runtime = "edge";

export type CoreDepartment = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  es_critico: number;
};

export async function GET() {
  await ensureCampamentoBase();
  const items = await queryAll<CoreDepartment>(
    "SELECT id, slug, nombre, descripcion, es_critico FROM core_departments ORDER BY nombre"
  );
  return NextResponse.json({ items, count: items.length });
}
