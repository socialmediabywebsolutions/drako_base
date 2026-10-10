/**
 * Entry del Worker web de SocialCors (P3).
 *
 * `fetch` delega en el handler generado por OpenNext. `scheduled` sustituye, para
 * esta app, al parche regex scripts/patch-socialflow-cron-handler.mjs: misma tabla
 * cron → rutas y mismo transporte (env.SELF, nunca la red pública; ver el comentario
 * de SELF en wrangler.toml). Cada ruta aplica su propio cron_locks (guardCronTurn).
 *
 * Este fichero lo empaqueta wrangler (esbuild) tras `opennextjs-cloudflare build`;
 * no entra en el typecheck de la app porque ./.open-next/worker.js solo existe tras el build.
 */
// @ts-ignore -- generado por `opennextjs-cloudflare build`
import openNextWorker from "./.open-next/worker.js";

type ScheduledEnv = {
  APP_URL?: string;
  CRON_SECRET?: string;
  SELF?: { fetch: typeof fetch };
};

type ScheduledEventLike = { cron: string };

const CRON_ROUTES: Record<string, string[]> = {
  "*/20 * * * *": ["/api/cron/social/trend-keywords"],
  "0 */4 * * *": ["/api/cron/social/metrics", "/api/cron/social/viral-moment"],
  "0 3 * * *": [
    "/api/cron/social/style-learning",
    "/api/cron/social/seasonality",
    "/api/cron/social/audience-insights",
    "/api/cron/social/seasonal-opportunity",
    "/api/cron/social/churn-prediction",
    "/api/socialflow/cron/prospector-followup",
  ],
  "0 3 * * 1": [
    "/api/cron/social/niche-intelligence",
    "/api/cron/social/influencer-benchmark",
    "/api/cron/social/cross-tenant-intelligence",
    "/api/cron/social/viral-opportunity",
    "/api/cron/social/weekly-briefing",
    "/api/cron/social/best-practices",
    "/api/cron/social/strategic-plan",
  ],
  // CompetitorDiscoveryAgent — lunes 04:00 UTC, una hora después del bloque de inteligencia
  // semanal de las 03:00 para no solapar con las corridas largas de niche-intelligence.
  "0 4 * * 1": ["/api/cron/social/competitor-discovery"],
};

// "*/5 * * * *" y cualquier expresión no listada.
const DEFAULT_CRON_ROUTES = ["/api/cron/social", "/api/cron/social/comments"];

function resolveCronRoutes(cron: string): string[] {
  return CRON_ROUTES[cron] ?? DEFAULT_CRON_ROUTES;
}

async function scheduled(event: ScheduledEventLike, env: ScheduledEnv): Promise<void> {
  const appUrl = env.APP_URL ?? "https://socialflows.drako.systems";
  const secret = env.CRON_SECRET ?? "";
  if (!secret) {
    console.error("[Cron] CRON_SECRET not configured — skipping scheduled tasks");
    return;
  }
  const init = { headers: { authorization: `Bearer ${secret}` } };
  const client = env.SELF ?? { fetch };

  // Secuencial a propósito: el orden importa en los crons semanales (ver el parche original).
  for (const path of resolveCronRoutes(event.cron)) {
    try {
      const res = await client.fetch(appUrl + path, init);
      if (!res.ok) {
        console.error(`[Cron] ${path} responded ${res.status}`);
      }
    } catch (err) {
      console.error(`[Cron] ${path} failed:`, err instanceof Error ? err.message : String(err));
    }
  }
}

export default {
  fetch: openNextWorker.fetch,
  scheduled,
};
