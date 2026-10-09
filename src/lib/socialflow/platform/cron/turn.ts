// Copia de src/lib/security/cron-turn.ts para SocialCors (P5). El holding conserva el original; no se comparten módulos.
// Núcleo de cron_locks sin dependencias de Next.js: lo usan guardCronTurn (rutas
// /api/cron/social/*, ver cron-lock.ts) y los scheduled() de los Workers que no pasan
// por HTTP (Worker IA de SocialCors).

const LOCK_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

// Misma semántica que guardCronTurn sin depender de una Request: la usan los handlers
// scheduled() que no pasan por una ruta HTTP (Worker IA). claimed=false solo cuando
// otra ejecución ya tiene el turno; cualquier otro fallo de D1 es fail-open.
export async function claimCronTurn(
  db: D1Database,
  lockKey: string,
  intervalMinutes: number,
): Promise<{ claimed: boolean; turn: string }> {
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
      return { claimed: false, turn };
    }
    console.error("[cron-lock] lock insert failed, running anyway", lockKey, message);
    return { claimed: true, turn };
  }

  await db
    .prepare(`DELETE FROM cron_locks WHERE created_at < ?`)
    .bind(new Date(now - LOCK_RETENTION_MS).toISOString())
    .run()
    .catch(() => {});

  return { claimed: true, turn };
}
