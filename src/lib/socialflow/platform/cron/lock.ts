// Copia de src/lib/security/cron-lock.ts para SocialCors (P5). El holding conserva el original; no se comparten módulos.
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/cf";
import { claimCronTurn } from "@/lib/socialflow/platform/cron/turn";

// Bloqueo por turno para las rutas de /api/cron/social/*. Cloudflare entrega a veces el
// mismo evento scheduled dos veces cuando varias expresiones de cron coinciden en el mismo
// minuto (visto con wrangler tail: */5 y */20 dos veces a las 12:40:32 y 12:40:48 del
// 2026-09-26), y hasta este cambio el runbook de GitHub Actions llamaba además a las
// mismas rutas — cada llamada extra repetía llamadas a IA y duplicaba filas.
//
// turn = inicio del intervalo del cron (epoch redondeado a intervalMinutes), así todas
// las llamadas de un mismo turno comparten clave aunque lleguen con segundos de
// diferencia. La primera que consigue el INSERT ejecuta; el resto recibe 200 sin hacer
// nada. ?force=1 lo salta (reejecución manual desde el runbook con workflow_dispatch).
//
// Fail-open: si la tabla no existe o D1 falla por otro motivo, la ruta se ejecuta
// igual — un fallo del lock nunca debe parar un cron.
export async function guardCronTurn(
  request: NextRequest,
  lockKey: string,
  intervalMinutes: number,
): Promise<NextResponse | null> {
  if (request.nextUrl.searchParams.get("force") === "1") return null;

  const db = env()?.SOCIAL_DB;
  if (!db) return null;

  const { claimed, turn } = await claimCronTurn(db, lockKey, intervalMinutes);
  if (!claimed) {
    return NextResponse.json({ ok: true, skipped: "ALREADY_RAN_THIS_TURN", lockKey, turn });
  }
  return null;
}
