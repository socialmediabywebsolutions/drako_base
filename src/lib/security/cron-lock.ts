import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/cf";

const LOCK_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

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

  const intervalMs = intervalMinutes * 60 * 1000;
  const now = Date.now();
  const turn = new Date(Math.floor(now / intervalMs) * intervalMs).toISOString();

  try {
    await db
      .prepare(`INSERT INTO cron_locks (cron_route, turn, created_at) VALUES (?, ?, ?)`)
      .bind(lockKey, turn, new Date(now).toISOString())
      .run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/UNIQUE constraint failed/i.test(message)) {
      return NextResponse.json({ ok: true, skipped: "ALREADY_RAN_THIS_TURN", lockKey, turn });
    }
    console.error("[cron-lock] lock insert failed, running anyway", lockKey, message);
    return null;
  }

  await db
    .prepare(`DELETE FROM cron_locks WHERE created_at < ?`)
    .bind(new Date(now - LOCK_RETENTION_MS).toISOString())
    .run()
    .catch(() => {});

  return null;
}
