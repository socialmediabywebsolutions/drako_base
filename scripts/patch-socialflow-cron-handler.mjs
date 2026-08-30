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
 *     style-learning's published-post-count query, so new tenants get it too)
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
 *     per-tenant weekly briefing, run last so it can use that week's freshly-refreshed data)
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

// 4-space indent to match the style of the surrounding OpenNext-generated `fetch`.
const scheduledHandler = `    // __socialflowCronHandlerPatched
    async scheduled(event, env) {
        const appUrl = env.APP_URL ?? "https://socialflows.drako.systems";
        const secret = env.CRON_SECRET ?? "";
        if (!secret) {
            console.error("[Cron] CRON_SECRET not configured — skipping scheduled tasks");
            return;
        }
        const authHeaders = { headers: { authorization: "Bearer " + secret } };

        if (event.cron === "*/20 * * * *") {
            await fetch(appUrl + "/api/cron/social/trend-keywords", authHeaders).catch(function(err) {
                console.error("[Cron] scheduled trend-keywords failed:", err.message);
            });
            return;
        }

        if (event.cron === "0 */4 * * *") {
            await fetch(appUrl + "/api/cron/social/metrics", authHeaders).catch(function(err) {
                console.error("[Cron] scheduled metrics failed:", err.message);
            });
            await fetch(appUrl + "/api/cron/social/viral-moment", authHeaders).catch(function(err) {
                console.error("[Cron] scheduled viral-moment failed:", err.message);
            });
            return;
        }

        if (event.cron === "0 3 * * *") {
            await fetch(appUrl + "/api/cron/social/style-learning", authHeaders).catch(function(err) {
                console.error("[Cron] scheduled style-learning failed:", err.message);
            });
            await fetch(appUrl + "/api/cron/social/seasonality", authHeaders).catch(function(err) {
                console.error("[Cron] scheduled seasonality failed:", err.message);
            });
            await fetch(appUrl + "/api/cron/social/audience-insights", authHeaders).catch(function(err) {
                console.error("[Cron] scheduled audience-insights failed:", err.message);
            });
            await fetch(appUrl + "/api/cron/social/seasonal-opportunity", authHeaders).catch(function(err) {
                console.error("[Cron] scheduled seasonal-opportunity failed:", err.message);
            });
            return;
        }

        if (event.cron === "0 3 * * 1") {
            await fetch(appUrl + "/api/cron/social/niche-intelligence", authHeaders).catch(function(err) {
                console.error("[Cron] scheduled niche-intelligence failed:", err.message);
            });
            await fetch(appUrl + "/api/cron/social/influencer-benchmark", authHeaders).catch(function(err) {
                console.error("[Cron] scheduled influencer-benchmark failed:", err.message);
            });
            await fetch(appUrl + "/api/cron/social/cross-tenant-intelligence", authHeaders).catch(function(err) {
                console.error("[Cron] scheduled cross-tenant-intelligence failed:", err.message);
            });
            await fetch(appUrl + "/api/cron/social/viral-opportunity", authHeaders).catch(function(err) {
                console.error("[Cron] scheduled viral-opportunity failed:", err.message);
            });
            await fetch(appUrl + "/api/cron/social/weekly-briefing", authHeaders).catch(function(err) {
                console.error("[Cron] scheduled weekly-briefing failed:", err.message);
            });
            return;
        }

        await fetch(appUrl + "/api/cron/social", authHeaders).catch(function(err) {
            console.error("[Cron] scheduled publish failed:", err.message);
        });
        await fetch(appUrl + "/api/cron/social/comments", authHeaders).catch(function(err) {
            console.error("[Cron] scheduled comment auto-reply failed:", err.message);
        });
    },
`;

const patched = original.replace(insertionPattern, `export default {\n${scheduledHandler}`);

fs.writeFileSync(workerPath, patched, "utf8");
console.log("PATCH_SOCIALFLOW_CRON: scheduled handler injected into export default {}");
