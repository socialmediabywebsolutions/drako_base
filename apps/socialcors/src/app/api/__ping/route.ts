/**
 * Endpoint de diagnóstico mínimo — sin dependencias del monolito.
 * Solo importa Next.js. Si esto falla → el problema es de infraestructura CF/OpenNext.
 * Si pasa y el resto de rutas falla → el problema es en las importaciones del monolito.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, runtime: "socialcors", ts: Date.now() });
}
