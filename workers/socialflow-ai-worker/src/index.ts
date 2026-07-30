/**
 * socialflow-ai-worker — Dedicated consumer for saas-socialflow-ai-generation-queue
 *
 * Runs independently from the main SocialFlow OpenNext worker so that the
 * full SocialFlow AI campaign pipeline (~26 sequential Workers AI calls,
 * 50-280s+) is not bound by Cloudflare's HTTP response time limit.
 */

import { type MessageBatch, type ScheduledEvent } from "@cloudflare/workers-types";
import { setGlobalEnv, type DracoEnv } from "../../../src/lib/cf";
import { SocialFlowOrchestrator } from "../../../src/lib/socialflow/ai/SocialFlowOrchestrator";
import { resolveSocialContext, upsertSaasSocialCampaign } from "../../../src/lib/socialflow/repository";
import { processScheduledPosts } from "../../../src/lib/socialflow/scheduler";

export interface SocialFlowAiJob {
  tenantId: string;
  saasId: string;
  niche: string;
  tone: string;
  frequencyPerWeek: number;
  campaignId: string;
  startDate?: string | null;
  endDate?: string | null;
  provider?: string;
}

export default {
  async fetch(request: Request, env: DracoEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        ok: true,
        worker: "socialflow-ai-worker",
        time: new Date().toISOString(),
        bindings: {
          socialDb: env.SOCIAL_DB ? "connected" : "missing",
          ai: env.AI ? "connected" : "missing",
        },
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("socialflow-ai-worker", { status: 200 });
  },

  /**
   * Queue consumer: processes SocialFlow AI campaign generation jobs
   */
  async queue(batch: MessageBatch<SocialFlowAiJob>, env: DracoEnv): Promise<void> {
    setGlobalEnv(env);
    console.log(`[SocialFlowAiWorker] Processing batch of ${batch.messages.length} messages`);

    for (const message of batch.messages) {
      const job = message.body;
      console.log(`[SocialFlowAiWorker] Processing campaign ${job.campaignId} for tenant ${job.tenantId}`);

      try {
        await new SocialFlowOrchestrator().generateFullCampaign({
          tenantId: job.tenantId,
          saasId: job.saasId,
          niche: job.niche,
          tone: job.tone,
          frequencyPerWeek: job.frequencyPerWeek,
          campaignId: job.campaignId,
          startDate: job.startDate ?? null,
          endDate: job.endDate ?? null,
          provider: job.provider as "INSTAGRAM" | "LINKEDIN" | "FACEBOOK_PAGE" | "TIKTOK" | "TWITTER_X" | undefined,
        });
        console.log(`[SocialFlowAiWorker] Campaign ${job.campaignId} completed successfully`);
        message.ack();
      } catch (error) {
        console.error(`[SocialFlowAiWorker] Campaign ${job.campaignId} failed`, error);
        try {
          const ctx = await resolveSocialContext({ tenantId: job.tenantId, saasId: job.saasId });
          await upsertSaasSocialCampaign(ctx, {
            id: job.campaignId,
            saasId: job.saasId,
            name: `AI Campaign: ${job.niche}`,
            objective: null,
            status: "FAILED",
            targetSegment: "DEFAULT",
            startDate: null,
            endDate: null,
            budgetEstimate: null,
            notes: `Generation failed: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500),
          });
        } catch (markError) {
          console.error(`[SocialFlowAiWorker] Failed to mark campaign ${job.campaignId} as FAILED`, markError);
        }
        // Already recorded as a terminal failure - ack to avoid retry storms.
        message.ack();
      }
    }
  },

  async scheduled(_event: ScheduledEvent, env: DracoEnv, _ctx: ExecutionContext): Promise<void> {
    setGlobalEnv(env);
    try {
      const result = await processScheduledPosts();
      console.log("[SocialFlowCron] Batch complete", JSON.stringify({
        processed: result.results.length,
        recovered: result.recovered,
        results: result.results,
      }));
    } catch (error) {
      console.error("[SocialFlowCron] processScheduledPosts failed", error instanceof Error ? error.message : String(error));
    }
  },
};
