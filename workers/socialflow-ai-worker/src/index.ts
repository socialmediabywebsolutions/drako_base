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
  // Ausente en mensajes ya en vuelo antes de este campo existir — se tratan como
  // "campaign" (el único tipo que había), no como error.
  type?: "campaign";
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

// Real Video Generation (HappyHorse 1.0 I2V, alibaba/hh1-i2v) — mismo motivo que la
// generación completa de campañas para correr en este worker dedicado y no en el
// principal: un modelo de vídeo real puede tardar bastante más que el límite práctico
// de duración de request que ya se topó antes en este mismo pipeline (ver el comentario
// en generate-from-image/route.ts sobre el límite de ~30s de Cloudflare Workers).
export interface AiVideoJob {
  type: "ai_video";
  jobId: string;
  tenantId: string;
  saasId: string;
  imageUrl: string;
  // Key de R2 (no la URL pública) — permite leer los bytes de la imagen directo del
  // bucket (bucket.get) en vez de un fetch HTTP contra nuestro propio dominio público.
  imageKey: string;
  prompt?: string;
}

type QueueJobMessage = SocialFlowAiJob | AiVideoJob;

// alibaba/hh1-i2v — sin prefijo @cf/, sin versión 1.1 (confirmado en auditoría contra la
// documentación oficial de Cloudflare; el modelo no está todavía en el paquete de tipos
// @cloudflare/workers-types instalado, es demasiado nuevo, así que env.AI.run se llama
// con el string del modelo directamente, sin el genérico estricto por-modelo).
const AI_VIDEO_MODEL = "alibaba/hh1-i2v";

async function markVideoJobProcessing(db: DracoEnv["SOCIAL_DB"], jobId: string): Promise<void> {
  if (!db) return;
  await db
    .prepare(`UPDATE socialflow_ai_video_jobs SET status = 'processing', updated_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), jobId)
    .run();
}

async function markVideoJobCompleted(db: DracoEnv["SOCIAL_DB"], jobId: string, videoUrl: string): Promise<void> {
  if (!db) return;
  await db
    .prepare(`UPDATE socialflow_ai_video_jobs SET status = 'completed', video_url = ?, error = NULL, updated_at = ? WHERE id = ?`)
    .bind(videoUrl, new Date().toISOString(), jobId)
    .run();
}

async function markVideoJobFailed(db: DracoEnv["SOCIAL_DB"], jobId: string, errorMessage: string): Promise<void> {
  if (!db) return;
  await db
    .prepare(`UPDATE socialflow_ai_video_jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`)
    .bind(errorMessage.slice(0, 500), new Date().toISOString(), jobId)
    .run();
}

// Nunca lanza fuera de sí misma — cualquier fallo (bindings ausentes, el modelo no
// devuelve vídeo, la descarga o la subida a R2 fallan) se traduce a status 'failed' con
// el mensaje real, nunca deja el job colgado en 'processing' para siempre.
async function processAiVideoJob(job: AiVideoJob, env: DracoEnv): Promise<void> {
  const db = env.SOCIAL_DB;
  if (!db) {
    console.error(`[SocialFlowAiWorker] SOCIAL_DB not configured, cannot process video job ${job.jobId}`);
    return;
  }

  try {
    await markVideoJobProcessing(db, job.jobId);

    const bucket = env.SOCIAL_MEDIA_BUCKET;
    // SOCIAL_MEDIA_R2_PUBLIC_URL es un secreto de Wrangler (nunca aparece en
    // wrangler.workers.toml en texto plano, ver el propio archivo) — es POR WORKER, no
    // se comparte automáticamente entre saas-socialflows-prod y este worker aunque
    // apunten al mismo bucket físico; hay que confirmarlo/fijarlo aquí también con
    // `wrangler secret put SOCIAL_MEDIA_R2_PUBLIC_URL -c workers/socialflow-ai-worker/wrangler.workers.toml`.
    const baseUrl = env.SOCIAL_MEDIA_R2_PUBLIC_URL?.trim();
    const aiBinding = env.AI;
    if (!bucket || !baseUrl || !aiBinding?.run) {
      throw new Error("R2 or AI bindings not fully configured for AI video generation");
    }

    const result = (await aiBinding.run(AI_VIDEO_MODEL, {
      image: job.imageUrl,
      prompt: job.prompt || "smooth natural camera movement",
      duration: 5,
      resolution: "720P",
    })) as { result?: { video?: string } } | null;

    // result.video, no result.url — confirmado contra el ejemplo real de respuesta de
    // la documentación de Cloudflare para alibaba/hh1-i2v.
    const generatedVideoUrl = result?.result?.video;
    if (!generatedVideoUrl) {
      throw new Error("alibaba/hh1-i2v did not return a video URL");
    }

    const videoRes = await fetch(generatedVideoUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to download generated video (${videoRes.status})`);
    }
    const videoBuffer = await videoRes.arrayBuffer();

    // El vídeo que devuelve el modelo vive en un bucket R2 de Cloudflare, no en el
    // nuestro — se re-sube al bucket propio para tener control/durabilidad sobre el
    // asset, mismo criterio que ya se usa para el MP3 de narración TTS.
    const key = `reels/ai-video/${job.tenantId}/${job.jobId}.mp4`;
    await bucket.put(key, videoBuffer, { httpMetadata: { contentType: "video/mp4" } });

    const publicUrl = `${baseUrl.replace(/\/$/, "")}/${key}`;
    await markVideoJobCompleted(db, job.jobId, publicUrl);
    console.log(`[SocialFlowAiWorker] AI video job ${job.jobId} completed`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[SocialFlowAiWorker] AI video job ${job.jobId} failed`, message);
    await markVideoJobFailed(db, job.jobId, message).catch((markError) => {
      console.error(`[SocialFlowAiWorker] Failed to mark video job ${job.jobId} as failed`, markError);
    });
  }
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
   * Queue consumer: processes SocialFlow AI campaign generation jobs AND
   * AI video generation jobs (Real Video Generation, alibaba/hh1-i2v) — misma cola,
   * misma queue() handler, despachado por job.type. Mensajes sin `type` (en vuelo desde
   * antes de que este campo existiera) se tratan como "campaign", el único tipo que
   * había.
   */
  async queue(batch: MessageBatch<QueueJobMessage>, env: DracoEnv): Promise<void> {
    setGlobalEnv(env);
    console.log(`[SocialFlowAiWorker] Processing batch of ${batch.messages.length} messages`);

    for (const message of batch.messages) {
      const job = message.body;

      if (job.type === "ai_video") {
        console.log(`[SocialFlowAiWorker] Processing AI video job ${job.jobId} for tenant ${job.tenantId}`);
        await processAiVideoJob(job, env);
        message.ack();
        continue;
      }

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
