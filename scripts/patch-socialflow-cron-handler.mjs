#!/usr/bin/env node
/**
 * Post-build patch: injects a Cloudflare Workers `scheduled` handler into the
 * socialflows-standalone worker.js so that the [triggers] crons in
 * wrangler.workers.toml actually fire:
 *   - every 5 minutes: /api/cron/social (scheduled publishing) and
 *     /api/cron/social/comments (Instagram comment auto-reply)
 *   - every 20 minutes: /api/cron/social/trend-keywords (TrendKeywordAgent — one niche
 *     per invocation, oldest trend_last_fetched first, see runTrendKeywordCron)
 *   - every 4 hours, on the hour (see wrangler.workers.toml crons): /api/cron/social/metrics
 *     (processInstagramMetrics — collects per-post Instagram engagement/impressions into
 *     saas_social_metrics), then /api/cron/social/viral-moment (ViralMomentAgent — cross-
 *     references youtubeHooks/redditTopics/globalTrends per niche against its own topic
 *     tracking table, socialcors_viral_topic_tracking, to catch topics rising fast before
 *     they're mainstream; runs every 4h because trends move too fast for the daily cron)
 *   - once a day (0 3 * * *): /api/cron/social/style-learning (StyleLearningAgent), then
 *     /api/cron/social/seasonality (SeasonalityAgent — refreshes
 *     socialflow_seasonality_cache per niche+current-month, 30-day TTL so most nights
 *     it's a no-op scan; see runSeasonalityCron), then /api/cron/social/audience-insights
 *     (AudienceInsightAgent — detects recurring question patterns in real Instagram
 *     comments per tenant, seeds content suggestions into socialflow_intelligence_feed),
 *     then /api/cron/social/seasonal-opportunity (SeasonalOpportunityAgent — hardcoded
 *     day-precision event calendar per niche, e.g. San Valentín/Black Friday/Navidad,
 *     with 21/14/7-day countdown alerts; complementary to SeasonalityAgent's monthly
 *     context, not a replacement — enumerates via socialflow_profiles, not gated by
 *     style-learning's published-post-count query, so new tenants get it too), then
 *     /api/cron/social/churn-prediction (ChurnPredictionAgent — inactivity/churn risk
 *     score per tenant from days-since-last-post/login, rejection ratio, abandoned
 *     drafts; enumerates via socialflow_profiles for the same reason as
 *     seasonal-opportunity — low-activity tenants are exactly who this needs to see, and
 *     style-learning's gate would exclude them. Internal-only: never writes to
 *     socialflow_intelligence_feed, visible only via /api/operator/socialflow/churn-risk)
 *   - once a week, Mondays (0 3 * * 1): /api/cron/social/niche-intelligence
 *     (NicheIntelligenceCronAgent — refreshes socialcors_niche_intelligence), then
 *     /api/cron/social/influencer-benchmark (InfluencerBenchmarkAgent — top 3 YouTube
 *     channels by views per niche via the YouTube Data API, refreshes
 *     socialcors_influencer_benchmarks; independent of niche-intelligence's own data,
 *     just reuses the same NICHE_INTELLIGENCE_NICHES list, so order vs. it doesn't
 *     matter — placed here to keep both niche-level weekly crons together), then
 *     /api/cron/social/cross-tenant-intelligence (CrossTenantIntelligenceAgent —
 *     merges real, anonymized cross-tenant engagement patterns into that same row's
 *     analysis_json; must run after niche-intelligence or its merge lands on a row
 *     niche-intelligence is about to overwrite), then /api/cron/social/viral-opportunity
 *     (ViralOpportunityAgent — needs that week's freshly-merged engagementPatterns to
 *     find untried hooks/formats per tenant, so must run after cross-tenant-intelligence),
 *     then /api/cron/social/weekly-briefing (WeeklyBriefingAgent — generates + sends the
 *     per-tenant weekly briefing, run last so it can use that week's freshly-refreshed data),
 *     then /api/cron/social/best-practices (BestPracticesAgent — reads
 *     ContentPerformanceAgent snapshots, already fresh from the daily style-learning cron,
 *     across every tenant in the same niche+accountType to find the top 3 performers and
 *     compare the tenant's own patterns against their anonymized aggregate; no ordering
 *     dependency on the other weekly steps above, placed alongside strategic-plan since
 *     both are weekly cross-tenant synthesis agents), then /api/cron/social/strategic-plan
 *     (StrategicPlanningAgent — 1 Mistral call that
 *     synthesizes every other Cerebro agent's latest snapshot for the tenant into a
 *     monthly plan; run last of all so it reads that week's freshest data everywhere;
 *     shown as a pinned card in the CRM Social Inteligencia tab, not the feed scroll)
 *
 * The "standalone" artifact mode used for socialflows is a full runtime COPY of
 * the real OpenNext worker (scopeMode: "standalone-runtime-copy"), NOT a thin
 * re-export wrapper — it has real imports (./cloudflare/images.js, ./cloudflare/init.js,
 * ./middleware/handler.mjs, Durable Object re-exports) and ends with a literal
 *   export default { async fetch(request, env, ctx) { ... } };
 * so there is no "export { default } from" / "export * from" path to extract and
 * re-import. Instead we inject `scheduled` as an extra property of that same
 * object literal — inserted right after `export default {` rather than before its
 * closing brace, since the fetch body itself contains many nested `{`/`}` and would
 * make locating the matching closing brace fragile.
 */

import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const workerPath = path.join(
  projectRoot,
  ".open-next",
  "socialflows-standalone",
  "worker.js",
);

if (!fs.existsSync(workerPath)) {
  console.error(`PATCH_SOCIALFLOW_CRON: worker not found at ${workerPath}`);
  process.exit(1);
}

const original = fs.readFileSync(workerPath, "utf8");

if (original.includes("__socialflowCronHandlerPatched")) {
  console.log("PATCH_SOCIALFLOW_CRON: already applied, skipping");
  process.exit(0);
}

// Insertion point: the start of the top-level `export default { ... }` object that
// OpenNext generates (currently containing only `fetch`). We only need this opening
// brace, not the matching closing one.
const insertionPattern = /export default \{/;
const match = original.match(insertionPattern);
if (!match) {
  console.error("PATCH_SOCIALFLOW_CRON: could not find 'export default {' insertion point in worker.js");
  console.error("  First 20 lines of worker.js:");
  console.error(original.split("\n").slice(0, 20).join("\n"));
  process.exit(1);
}

// 4-space indent to match the style of the surrounding OpenNext-generated \`fetch\`.
//
// callRoute() usa env.SELF (service binding a sí mismo, ver wrangler.workers.toml)
// en vez del fetch() público global. Diagnóstico en vivo (wrangler tail, 2026-09-01):
// el cron */20 (TrendKeywordAgent) disparaba scheduled() con outcome "ok" y sin
// excepciones, pero casi nunca dejaba fila en agent_execution_log ni aparecía como
// petición entrante — consistente con que el fetch() público del propio Worker
// hacia su propio dominio quedaba bloqueado/challenged por el Bot Fight Mode /
// rate-limit de /api/* que docs/runbooks/waf-rate-limits.md documenta para la zona
// (fetch() no lanza en una respuesta de challenge, solo en fallo de red — por eso
// nunca se veía en los logs). Un service binding nunca toca la red pública ni el
// WAF. También loggea ahora el status de cada respuesta para que un fallo futuro
// dentro de la propia ruta (401, 500...) quede visible en vez de tragado en silencio.
const scheduledHandler = `    // __socialflowCronHandlerPatched
    async scheduled(event, env) {
        const appUrl = env.APP_URL ?? "https://socialflows.drako.systems";
        const secret = env.CRON_SECRET ?? "";
        if (!secret) {
            console.error("[Cron] CRON_SECRET not configured — skipping scheduled tasks");
            return;
        }
        const authHeaders = { headers: { authorization: "Bearer " + secret } };
        const client = env.SELF ?? { fetch };

        async function callRoute(path) {
            try {
                const res = await client.fetch(appUrl + path, authHeaders);
                if (!res.ok) {
                    console.error("[Cron] " + path + " responded " + res.status);
                }
            } catch (err) {
                console.error("[Cron] " + path + " failed:", err.message);
            }
        }

        if (event.cron === "*/20 * * * *") {
            await callRoute("/api/cron/social/trend-keywords");
            return;
        }

        if (event.cron === "0 */4 * * *") {
            await callRoute("/api/cron/social/metrics");
            await callRoute("/api/cron/social/viral-moment");
            return;
        }

        if (event.cron === "0 3 * * *") {
            await callRoute("/api/cron/social/style-learning");
            await callRoute("/api/cron/social/seasonality");
            await callRoute("/api/cron/social/audience-insights");
            await callRoute("/api/cron/social/seasonal-opportunity");
            await callRoute("/api/cron/social/churn-prediction");
            await callRoute("/api/socialflow/cron/prospector-followup");
            return;
        }

        if (event.cron === "0 3 * * 1") {
            await callRoute("/api/cron/social/niche-intelligence");
            await callRoute("/api/cron/social/influencer-benchmark");
            await callRoute("/api/cron/social/cross-tenant-intelligence");
            await callRoute("/api/cron/social/viral-opportunity");
            await callRoute("/api/cron/social/weekly-briefing");
            await callRoute("/api/cron/social/best-practices");
            await callRoute("/api/cron/social/strategic-plan");
            return;
        }

        await callRoute("/api/cron/social");
        await callRoute("/api/cron/social/comments");
    },
`;

const patched = original.replace(insertionPattern, `export default {\n${scheduledHandler}`);

fs.writeFileSync(workerPath, patched, "utf8");
console.log("PATCH_SOCIALFLOW_CRON: scheduled handler injected into export default {}");
