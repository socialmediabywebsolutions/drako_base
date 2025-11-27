// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * MODO DEV
 * ----------
 * De momento NO bloqueamos ningún request.
 * Más adelante aquí conectaremos Cloudflare Access / Auth real.
 */
export function middleware(_req: NextRequest) {
  return NextResponse.next();
}

// Ejecutar en todas las rutas
export const config = {
  matcher: "/:path*",
};
