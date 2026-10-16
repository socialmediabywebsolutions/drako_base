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
 *
 * NOTA: usamos dynamic import para capturar cualquier error de inicialización de OpenNext
 * (p.ej. top-level await que falla en middleware/handler.mjs) y exponerlo como respuesta
 * HTTP legible en lugar de un 500 opaco. Facilita la diagnosis en CI.
 */

// @ts-ignore -- generado por `opennextjs-cloudflare build`
type OpenNextWorker = { fetch: (req: Request, env: unknown, ctx: ExecutionContext) => Promise<Response> };
let _worker: OpenNextWorker | null = null;
let _initError: unknown = null;

// ── Captura de console.error para diagnóstico ──────────────────────────────
// Next.js llama a console.error cuando una ruta lanza una excepción no manejada.
// Capturamos los últimos 30 mensajes para exponerlos en /__diag.
const _capturedErrors: { ts: number; msg: string }[] = [];
const _origConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const msg = args.map((a) => (a instanceof Error ? a.stack ?? a.message : String(a))).join(" ");
  _capturedErrors.push({ ts: Date.now(), msg: msg.slice(0, 2000) });
  if (_capturedErrors.length > 30) _capturedErrors.shift();
  _origConsoleError(...args);
};

try {
  // @ts-ignore -- generado por `opennextjs-cloudflare build`
  const mod = await import("./.open-next/worker.js");
  _worker = (mod.default ?? mod) as OpenNextWorker;
} catch (err) {
  _initError = err;
  _origConsoleError("[worker.ts] OpenNext init FAILED:", err instanceof Error ? (err as Error).stack : String(err));
}

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

async function fetchHandler(req: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
  // Diagnostic endpoint — bypasses OpenNext completely for health checks
  const url = new URL(req.url);
  if (url.pathname === "/__diag") {
    // Opcional: hacer una llamada de prueba a Next.js y capturar el resultado
    let testResult: { status: number; headers: Record<string, string>; body: string } | null = null;
    if (_worker && !_initError) {
      try {
        const testReq = new Request(new URL("/api/__ping", req.url).toString(), {
          method: "GET",
          headers: { "user-agent": "diag-internal" },
        });
        const testResp = await _worker.fetch(testReq, env, ctx);
        const hdrs: Record<string, string> = {};
        testResp.headers.forEach((v, k) => { hdrs[k] = v; });
        testResult = {
          status: testResp.status,
          headers: hdrs,
          body: (await testResp.text()).slice(0, 500),
        };
      } catch (e) {
        testResult = { status: -1, headers: {}, body: String(e) };
      }
    }

    const info = {
      ok: !_initError && !!_worker,
      workerLoaded: !!_worker,
      initError: _initError ? (_initError instanceof Error ? (_initError as Error).stack ?? (_initError as Error).message : String(_initError)) : null,
      timestamp: Date.now(),
      pingTest: testResult,
      recentErrors: _capturedErrors.slice(-10),
    };
    return new Response(JSON.stringify(info, null, 2), {
      status: info.ok ? 200 : 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  if (_initError) {
    const msg = _initError instanceof Error ? _initError.stack ?? _initError.message : String(_initError);
    console.error("[worker.ts] Serving error response due to init failure:", msg);
    return new Response(
      `OpenNext initialization failed:\n\n${msg}`,
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  if (!_worker) {
    return new Response("OpenNext worker not loaded", { status: 500, headers: { "content-type": "text/plain" } });
  }
  try {
    return await _worker.fetch(req, env, ctx);
  } catch (err) {
    const msg = err instanceof Error ? err.stack ?? err.message : String(err);
    console.error("[worker.ts] fetch THREW:", msg);
    return new Response(
      `Worker fetch threw:\n\n${msg}`,
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
}

export default {
  fetch: fetchHandler,
  scheduled,
};
