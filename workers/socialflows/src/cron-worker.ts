// Thin wrapper around the OpenNext-compiled SocialFlow worker.
// Delegates all HTTP requests to the OpenNext fetch handler and adds a
// Cloudflare native cron trigger (scheduled) for auto-publishing posts.

// @ts-ignore — resolved by wrangler bundler at deploy time
import openNextApp from "../../../.open-next/socialflows-standalone/worker.js";

const PUBLISH_PATH = "/api/cron/social/publish";

export default {
  async fetch(
    request: Request,
    env: Record<string, unknown>,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return openNextApp.fetch(request, env, ctx);
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Record<string, unknown>,
    ctx: ExecutionContext,
  ): Promise<void> {
    const cronSecret =
      typeof env.CRON_SECRET === "string" ? env.CRON_SECRET.trim() : "";

    if (!cronSecret) {
      console.error(
        "[SocialFlow Cron] CRON_SECRET not configured — scheduled publish skipped",
      );
      return;
    }

    // Route internally through the Next.js app — no external network round-trip.
    const publishRequest = new Request(
      `https://socialflows.drako.systems${PUBLISH_PATH}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${cronSecret}` },
      },
    );

    try {
      const response = await openNextApp.fetch(publishRequest, env, ctx);
      const body = await response.text();
      console.log(
        `[SocialFlow Cron] publish HTTP ${response.status} — ${body.slice(0, 500)}`,
      );
    } catch (err) {
      console.error(
        "[SocialFlow Cron] scheduled publish threw:",
        err instanceof Error ? err.message : String(err),
      );
    }
  },
};
