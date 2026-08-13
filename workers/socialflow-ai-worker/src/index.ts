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
import { ImageAnalysisAgent, type ImageAnalysis } from "../../../src/lib/socialflow/ai/agents/ImageAnalysisAgent";
import { ContentGeneratorAgent } from "../../../src/lib/socialflow/ai/agents/ContentGeneratorAgent";
import { OptimizationAgent } from "../../../src/lib/socialflow/ai/agents/OptimizationAgent";
import { TrendAgent } from "../../../src/lib/socialflow/ai/agents/TrendAgent";
import { extractBestHourByFormat } from "../../../src/lib/socialflow/ai/agents/BestTimeToPostAgent";
import { pickOpenerCategory } from "../../../src/lib/socialflow/ai/openers/pickOpenerCategory";
import { cleanOpening } from "../../../src/lib/socialflow/ai/openers/cleanOpening";
import { defaultLocalModel } from "../../../src/lib/socialflow/ai/models/localModel";
import { getStyleHistory } from "../../../src/lib/socialflow/intelligence/NicheIntelligenceService";
import { generateNarrationTrackUrl } from "../../../src/lib/socialflow/reels/ReelsAgent";
import { reportSocialflowAiUsage } from "../../../src/lib/ai/usage";
import type { StrategyItem, KeywordEngineOutput } from "../../../src/lib/socialflow/ai/types";

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

// Real Video Generation (DashScope wanx2.5-vace-turbo, llamado por fetch() directo —
// tanto bytedance/seedance-2.0-fast como, antes, alibaba/hh1-i2v fallaban con
// AiGatewayError 2021 "Invalid User Credentials" al pasar por env.AI.run(), confirmado
// en ambos modelos de terceros, así que este pipeline ya no pasa por el AI Gateway de
// Cloudflare para el vídeo) — mismo motivo que la generación completa de campañas para
// correr en este worker dedicado y no en el principal: un modelo de vídeo real puede
// tardar bastante más que el límite práctico de duración de request que ya se topó
// antes en este mismo pipeline (ver el comentario en generate-from-image/route.ts
// sobre el límite de ~30s de Cloudflare Workers).
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

// DashScope (Alibaba) — API asíncrona ajena al AI Gateway de Cloudflare: se lanza la
// tarea, devuelve un task_id, y hay que hacer polling a DASHSCOPE_TASK_URL hasta que
// task_status sea SUCCEEDED/FAILED/CANCELED. El endpoint es por-workspace (WorkspaceId
// visible en la consola de Alibaba, panel de API Key) en vez del host genérico
// dashscope-intl.aliyuncs.com.
const DASHSCOPE_MODEL = "wan2.6-i2v-flash";
const DASHSCOPE_WORKSPACE_HOST = "https://ws-r3sfwy2fsvg530c6.ap-southeast-1.maas.aliyuncs.com";
const DASHSCOPE_SYNTHESIS_URL = `${DASHSCOPE_WORKSPACE_HOST}/api/v1/services/aigc/video-generation/video-synthesis`;
const DASHSCOPE_TASK_URL = (taskId: string) => `${DASHSCOPE_WORKSPACE_HOST}/api/v1/tasks/${taskId}`;
const DASHSCOPE_POLL_INTERVAL_MS = 5000;
const DASHSCOPE_MAX_POLL_MS = 5 * 60 * 1000;

interface DashScopeSynthesisResponse {
  output?: { task_id?: string };
  request_id?: string;
  code?: string;
  message?: string;
}

interface DashScopeTaskResponse {
  output?: {
    task_status?: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELED";
    video_url?: string;
    message?: string;
    code?: string;
  };
  request_id?: string;
}

// Lanza la tarea de generación de vídeo y hace polling hasta que complete. Nunca
// devuelve sin video_url — o resuelve con la URL real, o lanza con el motivo concreto
// (falta la API key, DashScope respondió con error HTTP, la tarea falló/expiró, etc.),
// para que el catch de processAiVideoJob marque el job como 'failed' con un mensaje útil.
async function generateVideoWithDashScope(env: DracoEnv, imageUrl: string, prompt: string): Promise<string> {
  const apiKey = env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY not configured");
  }

  const synthesisRes = await fetch(DASHSCOPE_SYNTHESIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-DashScope-Async": "enable",
    },
    body: JSON.stringify({
      model: DASHSCOPE_MODEL,
      input: { img_url: imageUrl, prompt },
      parameters: { size: "1080*1920", duration: 5, prompt_extend: true },
    }),
  });
  if (!synthesisRes.ok) {
    const errorText = await synthesisRes.text().catch(() => "");
    throw new Error(`DashScope video-synthesis request failed (${synthesisRes.status}): ${errorText.slice(0, 500)}`);
  }
  const synthesisBody = (await synthesisRes.json()) as DashScopeSynthesisResponse;
  const taskId = synthesisBody.output?.task_id;
  if (!taskId) {
    throw new Error(`DashScope video-synthesis response missing task_id: ${JSON.stringify(synthesisBody).slice(0, 500)}`);
  }

  const deadline = Date.now() + DASHSCOPE_MAX_POLL_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, DASHSCOPE_POLL_INTERVAL_MS));

    const taskRes = await fetch(DASHSCOPE_TASK_URL(taskId), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!taskRes.ok) {
      const errorText = await taskRes.text().catch(() => "");
      throw new Error(`DashScope task poll failed (${taskRes.status}): ${errorText.slice(0, 500)}`);
    }
    const taskBody = (await taskRes.json()) as DashScopeTaskResponse;
    const status = taskBody.output?.task_status;

    if (status === "SUCCEEDED") {
      const videoUrl = taskBody.output?.video_url;
      if (!videoUrl) {
        throw new Error(`DashScope task ${taskId} succeeded but returned no video_url`);
      }
      return videoUrl;
    }
    if (status === "FAILED" || status === "CANCELED") {
      throw new Error(`DashScope task ${taskId} ${status}: ${taskBody.output?.message ?? "no message"}`);
    }
    // PENDING / RUNNING — sigue en cola/procesando, se reintenta en el próximo tick.
  }

  throw new Error(`DashScope task ${taskId} timed out after ${DASHSCOPE_MAX_POLL_MS / 1000}s`);
}

// Apiframe (apiframe.ai) — proveedor PRIMARIO de vídeo IA, Kling 2.6 (image-to-video).
// Cuenta de Alibaba Cloud bloqueada por verificación KYC (AccessDenied.Unpurchased, sin
// fecha de resolución) — DashScope queda como fallback más abajo, no se borra.
// Endpoint/params confirmados contra docs.apiframe.ai (no existe Kling 3.0 ni un
// endpoint genérico /v2/videos/generate — cada modelo tiene su propia ruta fija en
// api.apiframe.pro, y el parámetro de imagen se llama image_url, no image). API
// asíncrona igual que DashScope: POST devuelve task_id, se hace polling a /fetch hasta
// status 'finished'/'failed'. aspect_ratio se ignora cuando se pasa image_url (el ratio
// de salida sigue al de la imagen de entrada) — no se manda, los R2 de Reels ya vienen
// en 9:16.
const APIFRAME_BASE_URL = "https://api.apiframe.pro";
const APIFRAME_KLING_2_6_URL = `${APIFRAME_BASE_URL}/kling-imagine-2-6`;
const APIFRAME_FETCH_URL = `${APIFRAME_BASE_URL}/fetch`;
const APIFRAME_MODEL = "kling-2.6";
// Kling 2.6 solo acepta 5 o 10 (segundos) — no un rango libre 3-15s.
const APIFRAME_VIDEO_DURATION_SECONDS = 5;
const APIFRAME_POLL_INTERVAL_MS = 5000;
const APIFRAME_MAX_POLL_MS = 5 * 60 * 1000;

interface ApiframeGenerateResponse {
  task_id?: string;
  errors?: { msg: string }[];
}

interface ApiframeTaskResponse {
  task_id?: string;
  task_type?: string;
  status?: "processing" | "finished" | "failed" | string;
  percentage?: string | number;
  video_url?: string;
  error?: string;
  errors?: { msg: string }[];
}

async function generateVideoWithApiframe(env: DracoEnv, imageUrl: string, prompt: string): Promise<string> {
  const apiKey = env.APIFRAME_API_KEY;
  if (!apiKey) {
    throw new Error("APIFRAME_API_KEY not configured");
  }

  const generateRes = await fetch(APIFRAME_KLING_2_6_URL, {
    method: "POST",
    headers: {
      // docs.apiframe.ai: sin prefijo "Bearer", el valor del header ES la API key.
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_url: imageUrl,
      duration: APIFRAME_VIDEO_DURATION_SECONDS,
      generate_audio: false,
    }),
  });
  if (!generateRes.ok) {
    const errorText = await generateRes.text().catch(() => "");
    throw new Error(`Apiframe kling-imagine-2-6 request failed (${generateRes.status}): ${errorText.slice(0, 500)}`);
  }
  const generateBody = (await generateRes.json()) as ApiframeGenerateResponse;
  const taskId = generateBody.task_id;
  if (!taskId) {
    throw new Error(`Apiframe kling-imagine-2-6 response missing task_id: ${JSON.stringify(generateBody).slice(0, 500)}`);
  }

  const deadline = Date.now() + APIFRAME_MAX_POLL_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, APIFRAME_POLL_INTERVAL_MS));

    const taskRes = await fetch(APIFRAME_FETCH_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ task_id: taskId }),
    });
    if (!taskRes.ok) {
      const errorText = await taskRes.text().catch(() => "");
      throw new Error(`Apiframe fetch task poll failed (${taskRes.status}): ${errorText.slice(0, 500)}`);
    }
    const taskBody = (await taskRes.json()) as ApiframeTaskResponse;

    if (taskBody.status === "finished") {
      if (!taskBody.video_url) {
        throw new Error(`Apiframe task ${taskId} finished but returned no video_url`);
      }
      return taskBody.video_url;
    }
    if (taskBody.status === "failed") {
      throw new Error(`Apiframe task ${taskId} failed: ${taskBody.error ?? taskBody.errors?.[0]?.msg ?? "no message"}`);
    }
    // 'processing' — sigue en cola, se reintenta en el próximo tick.
  }

  throw new Error(`Apiframe task ${taskId} timed out after ${APIFRAME_MAX_POLL_MS / 1000}s`);
}

async function markVideoJobProcessing(db: DracoEnv["SOCIAL_DB"], jobId: string): Promise<void> {
  if (!db) return;
  await db
    .prepare(`UPDATE socialflow_ai_video_jobs SET status = 'processing', updated_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), jobId)
    .run();
}

async function markVideoJobCompleted(
  db: DracoEnv["SOCIAL_DB"],
  jobId: string,
  result: {
    videoUrl: string;
    caption: string;
    hashtags: string[];
    narrationUrl: string | undefined;
    suggestedScheduledAt: string;
    animationPrompt: string;
  },
): Promise<void> {
  if (!db) return;
  await db
    .prepare(
      `UPDATE socialflow_ai_video_jobs
       SET status = 'completed', video_url = ?, caption = ?, hashtags = ?, narration_url = ?,
           suggested_scheduled_at = ?, animation_prompt = ?, error = NULL, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      result.videoUrl,
      result.caption,
      JSON.stringify(result.hashtags),
      result.narrationUrl ?? null,
      result.suggestedScheduledAt,
      result.animationPrompt,
      new Date().toISOString(),
      jobId,
    )
    .run();
}

async function markVideoJobFailed(db: DracoEnv["SOCIAL_DB"], jobId: string, errorMessage: string): Promise<void> {
  if (!db) return;
  await db
    .prepare(`UPDATE socialflow_ai_video_jobs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?`)
    .bind(errorMessage.slice(0, 500), new Date().toISOString(), jobId)
    .run();
}

const DEFAULT_ANIMATION_PROMPT = "smooth natural camera movement";

// Prompt de animación específico para Seedance a partir del análisis real de la imagen
// (en vez del genérico DEFAULT_ANIMATION_PROMPT de siempre) — ~30 palabras en inglés
// describiendo movimiento natural y físicamente plausible (pelo, ropa, ambiente, luz).
// generateStructured nunca lanza (degrada al seed determinista internamente), así que
// esta función tampoco necesita su propio try/catch.
async function generateAnimationPrompt(input: {
  imageAnalysis: ImageAnalysis;
  niche: string;
  tenantId: string;
  saasId: string;
}): Promise<string> {
  const { data, isFallback } = await defaultLocalModel.generateStructured<{ prompt: string }>(
    {
      prompt: `You are writing a short motion-generation instruction for an AI image-to-video model (Seedance) that will animate a still photo.

Image description: ${input.imageAnalysis.description}
Visual context: ${input.imageAnalysis.context}
Themes: ${input.imageAnalysis.suggestedThemes.join(", ")}
Niche: ${input.niche}

Write ONE prompt in ENGLISH, around 30 words, describing SUBTLE, NATURAL movement appropriate to this specific image — hair, clothing, ambient elements (leaves, water, light), gentle camera drift. No dramatic action, no scene changes, no on-screen text. Physically plausible motion only.

Respond with ONLY this JSON: {"prompt": "..."}`,
      tenantId: input.tenantId,
      saasId: input.saasId,
    },
    () => ({ prompt: DEFAULT_ANIMATION_PROMPT }),
  );
  const prompt = typeof data.prompt === "string" ? data.prompt.trim() : "";
  return !isFallback && prompt ? prompt : DEFAULT_ANIMATION_PROMPT;
}

// Hora sugerida para programar el Reel — usa el mejor horario histórico para formato
// REEL (mismo snapshot que BestTimeToPostAgent ya calcula para el resto del calendario)
// si hay suficiente historial; si no, +1h desde ahora, mismo fallback que ya usa
// ReelsCreator/PublishReel cuando generate-from-image no devuelve un scheduledAt real.
// Es una SUGERENCIA — el cliente la muestra editable antes de aprobar, nunca un slot
// reservado en firme (a diferencia de computeScheduledSlot en generate-from-image, que
// sí evita colisiones reales de calendario — innecesario aquí, un solo vídeo ad-hoc).
async function computeSuggestedScheduledAt(tenantId: string, saasId: string, env: DracoEnv): Promise<string> {
  const fallback = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
  try {
    const styleHistory = await getStyleHistory(tenantId, saasId, env);
    const preferredHour = styleHistory[0] ? extractBestHourByFormat(styleHistory[0].snapshotJson)?.REEL : null;
    if (typeof preferredHour !== "number") return fallback();

    const now = new Date();
    const candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), preferredHour, 0, 0, 0));
    if (candidate.getTime() <= Date.now()) candidate.setUTCDate(candidate.getUTCDate() + 1);
    return candidate.toISOString();
  } catch {
    return fallback();
  }
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
    if (!bucket || !baseUrl || !env.APIFRAME_API_KEY) {
      throw new Error("R2 bindings or APIFRAME_API_KEY not fully configured for AI video generation");
    }

    // Paso 1 — bytes de la imagen directo del bucket (mismo objeto que subió
    // /api/socialflow/media/upload) — sin fetch HTTP contra nuestro propio dominio público.
    const imageObject = await bucket.get(job.imageKey);
    if (!imageObject) {
      throw new Error(`Image not found in R2 for key ${job.imageKey}`);
    }
    const imageBytes = Array.from(new Uint8Array(await imageObject.arrayBuffer()));

    // Paso 2 — BrandProfile completo (KB, seasonalContext, nicheIntel) — mismo builder
    // que generate-from-image/route.ts usa para el flujo normal de foto→post.
    const profile = await new SocialFlowOrchestrator().buildProfile({
      tenantId: job.tenantId,
      saasId: job.saasId,
      niche: "",
      tone: "",
      frequencyPerWeek: 1,
    });

    // Paso 3 — análisis visual real (Mistral vision).
    const imageAnalysis = await new ImageAnalysisAgent().run({
      imageBytes,
      profile,
      tenantId: job.tenantId,
      saasId: job.saasId,
    });

    // Paso 4 — prompt de animación específico para Seedance, basado en el análisis real
    // de la imagen. job.prompt (override manual opcional, ver generate-ai-video/route.ts)
    // sigue teniendo prioridad si algún caller futuro lo manda explícito.
    const animationPrompt =
      job.prompt || (await generateAnimationPrompt({ imageAnalysis, niche: profile.niche, tenantId: job.tenantId, saasId: job.saasId }));

    // Paso 5 — caption + hashtags completos, mismo pipeline que Posts/Reels normales:
    // ContentGeneratorAgent seguido de OptimizationAgent (fuerza 10-15 hashtags, limpia
    // el opening). llavaSuggestedFormat se fuerza a "REEL" — el formato ya está decidido
    // por el cliente al elegir Vídeo IA, no lo vuelve a inferir de la imagen.
    const trends = await new TrendAgent().run({ profile });
    const strategyItem: StrategyItem = {
      id: `aivideo_${job.jobId}`,
      dayOffset: 0,
      theme: imageAnalysis.context,
      angle: imageAnalysis.suggestedThemes[0] ?? profile.niche,
      format: "reel",
      callToAction: profile.primaryCTA || "Conoce más en el enlace de la bio.",
    };
    const imageThemeHashtags = imageAnalysis.suggestedThemes
      .map((t) => `#${t.replace(/\s+/g, "").replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9]/g, "").toLowerCase()}`)
      .filter((h) => h.length > 2);
    const keywordEngine: KeywordEngineOutput = {
      clusters: profile.contentPillars.slice(0, 3).map((pillar, i) => ({
        cluster: pillar,
        intent: (["awareness", "consideration", "conversion"] as const)[i % 3],
        difficulty: "medium" as const,
        trendScore: 70,
        seasonality: null,
        contentAngles: imageAnalysis.suggestedThemes,
        keywords: profile.baseKeywords.slice(0, 3),
        hashtags: profile.baseHashtags.slice(0, 5),
      })),
      evergreenHashtags: profile.baseHashtags,
      trendingHashtags: [
        ...trends.trendingTopics.map((t) => `#${t.replace(/\s+/g, "").replace(/[^a-zA-ZáéíóúüñÁÉÍÓÚÜÑ0-9]/g, "").toLowerCase()}`),
        ...imageThemeHashtags,
      ].filter((h) => h.length > 2).slice(0, 10),
      nicheHashtags: profile.competitorHashtags.slice(0, 5),
      viralHashtags: profile.viralThemes.map((t) => `#${t.replace(/\s+/g, "").toLowerCase()}`),
      campaignHashtags: profile.priorityHashtags,
    };

    const generated = await new ContentGeneratorAgent().run({
      profile,
      strategyItem,
      keywordEngine,
      trends,
      openerIndex: 0,
      openerCategory: pickOpenerCategory(imageAnalysis, strategyItem.theme),
      specificContext: imageAnalysis.specificContext,
      llavaSuggestedFormat: "REEL",
      momentType: imageAnalysis.momentType,
      employeeDetected: imageAnalysis.employeeDetected,
      tenantId: job.tenantId,
      saasId: job.saasId,
    });
    const optimized = await new OptimizationAgent().run({
      profile,
      variant: generated.variants[0],
      keywordEngine,
    });
    optimized.improvedText = cleanOpening(optimized.improvedText);
    if (optimized.hashtags.length < 10) {
      const supplementPool = [
        ...optimized.hashtags,
        ...imageThemeHashtags,
        ...(profile.competitorHashtags ?? []),
        ...(profile.priorityHashtags ?? []),
        ...(profile.baseHashtags ?? []),
      ];
      optimized.hashtags = Array.from(new Set(supplementPool)).filter(Boolean).slice(0, 15);
    }

    // Paso 6 — narración de voz (guion Mistral + TTS @cf/deepgram/aura-2-es), reutiliza
    // el mismo generador que ya usa el Reel con efectos — nunca lanza, degrada a
    // undefined si cualquier paso falla (bindings, Mistral, TTS o R2).
    const narrationUrl = await generateNarrationTrackUrl({
      niche: profile.niche,
      tema: strategyItem.theme,
      seasonalContext: profile.seasonalContext,
      tenantId: job.tenantId,
      saasId: job.saasId,
    });

    // Paso 7 — hora sugerida para programar (editable por el cliente antes de aprobar).
    const suggestedScheduledAt = await computeSuggestedScheduledAt(job.tenantId, job.saasId, env);

    // Paso 8 — el vídeo real con el prompt inteligente del paso 4. Apiframe/Kling 2.6 es
    // el proveedor PRIMARIO (ver generateVideoWithApiframe); DashScope queda como
    // fallback si Apiframe falla y hay DASHSCOPE_API_KEY configurada — el código de
    // DashScope no se borra, solo deja de ser la vía principal (cuenta de Alibaba Cloud
    // bloqueada por verificación KYC, AccessDenied.Unpurchased, sin fecha de resolución).
    // Try/catch específico (aparte del genérico de processAiVideoJob) para loguear el
    // error crudo de cada proveedor antes de relanzar — el catch exterior sigue marcando
    // el job como 'failed' igual que hoy.
    let generatedVideoUrl: string;
    try {
      generatedVideoUrl = await generateVideoWithApiframe(env, job.imageUrl, animationPrompt);
      void reportSocialflowAiUsage({
        tenantId: job.tenantId,
        agent: "VideoIA",
        model: APIFRAME_MODEL,
        durationSeconds: APIFRAME_VIDEO_DURATION_SECONDS,
      });
    } catch (primaryError) {
      const propertyNames =
        typeof primaryError === "object" && primaryError !== null ? Object.getOwnPropertyNames(primaryError) : undefined;
      console.error(`[${APIFRAME_MODEL}] RAW ERROR`, JSON.stringify(primaryError, propertyNames));

      if (!env.DASHSCOPE_API_KEY) {
        throw primaryError;
      }

      console.error(
        `[SocialFlowAiWorker] Apiframe failed for job ${job.jobId}, falling back to DashScope`,
        primaryError instanceof Error ? primaryError.message : String(primaryError),
      );
      try {
        generatedVideoUrl = await generateVideoWithDashScope(env, job.imageUrl, animationPrompt);
      } catch (fallbackError) {
        const fallbackPropertyNames =
          typeof fallbackError === "object" && fallbackError !== null ? Object.getOwnPropertyNames(fallbackError) : undefined;
        console.error(`[${DASHSCOPE_MODEL}] RAW ERROR (fallback)`, JSON.stringify(fallbackError, fallbackPropertyNames));
        throw fallbackError;
      }
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

    await markVideoJobCompleted(db, job.jobId, {
      videoUrl: publicUrl,
      caption: optimized.improvedText,
      hashtags: optimized.hashtags,
      narrationUrl,
      suggestedScheduledAt,
      animationPrompt,
    });
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
          apiframe: env.APIFRAME_API_KEY ? "connected" : "missing",
          dashscope: env.DASHSCOPE_API_KEY ? "connected" : "missing",
        },
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("socialflow-ai-worker", { status: 200 });
  },

  /**
   * Queue consumer: processes SocialFlow AI campaign generation jobs AND
   * AI video generation jobs (Real Video Generation, bytedance/seedance-2.0-fast) — misma cola,
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
