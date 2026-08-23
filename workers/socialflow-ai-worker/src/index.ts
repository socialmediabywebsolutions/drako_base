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
import { runTrendAutoApproveCron } from "../../../src/lib/socialflow/intelligence/TrendAutoApproveCron";
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

// PiAPI (piapi.ai) — proveedor PRIMARIO de vídeo IA, Kling 2.6 (image-to-video). Apiframe
// pasa a ser el fallback SECUNDARIO (exige suscripción mínima de $19/mes para poder
// comprar créditos pay-as-you-go — bloquea el uso sin ingresos aún; PiAPI da créditos
// gratis al registro sin esa exigencia, y su pay-as-you-go es más barato: $0.20/5s
// Standard vs $0.60/5s en Apiframe). Confirmado contra piapi.ai/docs (create-task +
// get-task, no hay trampa de versión tipo la de Apiframe v1/v2): base URL
// https://api.piapi.ai, auth por header x-api-key (valor crudo, sin "Bearer"), endpoint
// único POST /api/v1/task para TODOS los modelos con { model: "kling", task_type:
// "video_generation", input: {...} } — el modelo Kling concreto se elige con
// input.version ("2.6"), no con una ruta distinta. Polling en GET /api/v1/task/{task_id}
// hasta status "completed"/"failed" (la doc usa distinta capitalización según la página
// — "Pending"/"pending" — se normaliza a minúsculas al comparar). El vídeo final viene
// en data.output.video en el ejemplo real de respuesta completada, aunque el schema
// genérico de la doc de creación muestra "video_url" — se comprueban ambos campos por
// seguridad. aspect_ratio es "requerido para text-to-video" (implícitamente no aplica
// con image_url) — no se manda, mismo criterio que con Apiframe/DashScope.
const PIAPI_BASE_URL = "https://api.piapi.ai";
const PIAPI_CREATE_TASK_URL = `${PIAPI_BASE_URL}/api/v1/task`;
const PIAPI_TASK_URL = (taskId: string) => `${PIAPI_BASE_URL}/api/v1/task/${taskId}`;
const PIAPI_KLING_VERSION = "2.6";
const PIAPI_MODEL = `piapi-kling-${PIAPI_KLING_VERSION}`;
// "std" (Standard) es el tier barato ($0.20/5s) — "pro" cuesta más ($0.33/5s).
const PIAPI_MODE = "std";
const PIAPI_VIDEO_DURATION_SECONDS = 5;
const PIAPI_POLL_INTERVAL_MS = 5000;
const PIAPI_MAX_POLL_MS = 5 * 60 * 1000;

interface PiapiCreateTaskResponse {
  code?: number;
  data?: { task_id?: string };
  message?: string;
}

interface PiapiTaskResponse {
  code?: number;
  data?: {
    task_id?: string;
    status?: string;
    output?: { video?: string; video_url?: string };
    error?: { code?: number; message?: string };
  };
  message?: string;
}

async function generateVideoWithPiapi(env: DracoEnv, imageUrl: string, prompt: string): Promise<string> {
  const apiKey = env.PIAPI_API_KEY;
  if (!apiKey) {
    throw new Error("PIAPI_API_KEY not configured");
  }

  const createRes = await fetch(PIAPI_CREATE_TASK_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "kling",
      task_type: "video_generation",
      input: {
        version: PIAPI_KLING_VERSION,
        prompt,
        image_url: imageUrl,
        duration: PIAPI_VIDEO_DURATION_SECONDS,
        mode: PIAPI_MODE,
        enable_audio: false,
      },
    }),
  });
  if (!createRes.ok) {
    const errorText = await createRes.text().catch(() => "");
    throw new Error(`PiAPI create task request failed (${createRes.status}): ${errorText.slice(0, 500)}`);
  }
  const createBody = (await createRes.json()) as PiapiCreateTaskResponse;
  const taskId = createBody.data?.task_id;
  if (!taskId) {
    throw new Error(`PiAPI create task response missing task_id: ${JSON.stringify(createBody).slice(0, 500)}`);
  }

  const deadline = Date.now() + PIAPI_MAX_POLL_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, PIAPI_POLL_INTERVAL_MS));

    const taskRes = await fetch(PIAPI_TASK_URL(taskId), {
      headers: { "x-api-key": apiKey },
    });
    if (!taskRes.ok) {
      const errorText = await taskRes.text().catch(() => "");
      throw new Error(`PiAPI task poll failed (${taskRes.status}): ${errorText.slice(0, 500)}`);
    }
    const taskBody = (await taskRes.json()) as PiapiTaskResponse;
    const status = taskBody.data?.status?.toLowerCase();

    if (status === "completed") {
      const videoUrl = taskBody.data?.output?.video ?? taskBody.data?.output?.video_url;
      if (!videoUrl) {
        throw new Error(`PiAPI task ${taskId} completed but returned no video: ${JSON.stringify(taskBody).slice(0, 500)}`);
      }
      return videoUrl;
    }
    if (status === "failed") {
      throw new Error(`PiAPI task ${taskId} failed: ${taskBody.data?.error?.message ?? "no message"}`);
    }
    // 'pending' / 'staged' / 'processing' — sigue en cola/procesando, se reintenta en el próximo tick.
  }

  throw new Error(`PiAPI task ${taskId} timed out after ${PIAPI_MAX_POLL_MS / 1000}s`);
}

// Apiframe (apiframe.ai) — proveedor SECUNDARIO de vídeo IA, Kling 2.6 (image-to-video).
// Cuenta de Alibaba Cloud (DashScope) bloqueada por verificación KYC (AccessDenied.
// Unpurchased, sin fecha de resolución) — DashScope queda como fallback terciario más
// abajo, no se borra.
// La API key configurada (prefijo afk_) es de Apiframe v2 — v1 y v2 NO son compatibles
// (rutas, header de auth y forma del body distintos, confirmado en producción con el
// error "Your API key starts with 'afk_' ... This endpoint is for Apiframe v1" al usar
// las rutas v1 de api.apiframe.pro). Confirmado contra apiframe.ai/docs (v2): base URL
// api.apiframe.ai/v2, auth vía header X-API-Key (no Authorization/Bearer), endpoint
// genérico POST /v2/videos/generate con { prompt, model, klingParams: {...} } (a
// diferencia de v1, que tenía una ruta fija por modelo), respuesta 202 con { jobId,
// status: "QUEUED" }, y polling en GET /v2/jobs/:id (no POST /fetch con task_id en el
// body) hasta status "COMPLETED"/"FAILED". v2 sí tiene Kling 3.0 (duration 3-15s, mode
// standard/pro/4k) además de Kling 2.6 — se mantiene 2.6 (duration solo 5 o 10s, sin
// mode) por ser más barato en créditos para un clip corto. klingParams.start_image es
// el parámetro de imagen (no image_url) — no se manda aspect_ratio, la doc no confirma
// que se ignore con start_image y los R2 de Reels ya vienen en 9:16.
const APIFRAME_BASE_URL = "https://api.apiframe.ai/v2";
const APIFRAME_GENERATE_URL = `${APIFRAME_BASE_URL}/videos/generate`;
const APIFRAME_JOB_URL = (jobId: string) => `${APIFRAME_BASE_URL}/jobs/${jobId}`;
const APIFRAME_MODEL = "kling-2.6";
// Kling 2.6 solo acepta 5 o 10 (segundos) — no un rango libre 3-15s (eso es Kling 3.0).
const APIFRAME_VIDEO_DURATION_SECONDS = 5;
const APIFRAME_POLL_INTERVAL_MS = 5000;
const APIFRAME_MAX_POLL_MS = 5 * 60 * 1000;

interface ApiframeGenerateResponse {
  jobId?: string;
  status?: string;
  errors?: { msg: string }[];
}

interface ApiframeJobResponse {
  jobId?: string;
  status?: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | string;
  progress?: number;
  videoUrl?: string;
  result?: { videoUrl?: string };
  error?: string;
  errors?: { msg: string }[];
}

async function generateVideoWithApiframe(env: DracoEnv, imageUrl: string, prompt: string): Promise<string> {
  const apiKey = env.APIFRAME_API_KEY;
  if (!apiKey) {
    throw new Error("APIFRAME_API_KEY not configured");
  }

  const generateRes = await fetch(APIFRAME_GENERATE_URL, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      model: APIFRAME_MODEL,
      klingParams: {
        duration: APIFRAME_VIDEO_DURATION_SECONDS,
        start_image: imageUrl,
        generate_audio: false,
      },
    }),
  });
  if (!generateRes.ok) {
    const errorText = await generateRes.text().catch(() => "");
    throw new Error(`Apiframe videos/generate request failed (${generateRes.status}): ${errorText.slice(0, 500)}`);
  }
  const generateBody = (await generateRes.json()) as ApiframeGenerateResponse;
  const jobId = generateBody.jobId;
  if (!jobId) {
    throw new Error(`Apiframe videos/generate response missing jobId: ${JSON.stringify(generateBody).slice(0, 500)}`);
  }

  const deadline = Date.now() + APIFRAME_MAX_POLL_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, APIFRAME_POLL_INTERVAL_MS));

    const jobRes = await fetch(APIFRAME_JOB_URL(jobId), {
      headers: { "X-API-Key": apiKey },
    });
    if (!jobRes.ok) {
      const errorText = await jobRes.text().catch(() => "");
      throw new Error(`Apiframe job poll failed (${jobRes.status}): ${errorText.slice(0, 500)}`);
    }
    const jobBody = (await jobRes.json()) as ApiframeJobResponse;

    if (jobBody.status === "COMPLETED") {
      const videoUrl = jobBody.result?.videoUrl ?? jobBody.videoUrl;
      if (!videoUrl) {
        throw new Error(`Apiframe job ${jobId} completed but returned no videoUrl: ${JSON.stringify(jobBody).slice(0, 500)}`);
      }
      return videoUrl;
    }
    if (jobBody.status === "FAILED") {
      throw new Error(`Apiframe job ${jobId} failed: ${jobBody.error ?? jobBody.errors?.[0]?.msg ?? "no message"}`);
    }
    // 'QUEUED' / 'PROCESSING' — sigue en cola/procesando, se reintenta en el próximo tick.
  }

  throw new Error(`Apiframe job ${jobId} timed out after ${APIFRAME_MAX_POLL_MS / 1000}s`);
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

// Prueba cada proveedor de vídeo en orden (PiAPI → Apiframe → DashScope hoy), pasando al
// siguiente SOLO si el anterior lanza y está configurado (tiene su API key) — nunca
// prueba uno sin key, para no perder tiempo en un fallo garantizado. Loguea el error
// crudo de cada intento fallido (mismo criterio que ya usaba el try/catch específico de
// Paso 8) antes de pasar al siguiente; si todos fallan, relanza el error del último
// intento real.
async function generateVideoWithFallbacks(
  providers: { label: string; model: string; enabled: boolean; generate: () => Promise<string> }[],
): Promise<{ videoUrl: string; model: string }> {
  let lastError: unknown = new Error("No AI video provider configured (no API key set for any provider)");

  for (const provider of providers) {
    if (!provider.enabled) continue;
    try {
      const videoUrl = await provider.generate();
      return { videoUrl, model: provider.model };
    } catch (error) {
      const propertyNames = typeof error === "object" && error !== null ? Object.getOwnPropertyNames(error) : undefined;
      console.error(`[${provider.label}] RAW ERROR`, JSON.stringify(error, propertyNames));
      lastError = error;
    }
  }

  throw lastError;
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
    if (!bucket || !baseUrl || !env.PIAPI_API_KEY) {
      throw new Error("R2 bindings or PIAPI_API_KEY not fully configured for AI video generation");
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

    // Paso 8 — el vídeo real con el prompt inteligente del paso 4. Orden de proveedores:
    // PiAPI (primario — sin suscripción mínima, más barato) → Apiframe (secundario) →
    // DashScope (terciario, cuenta de Alibaba Cloud bloqueada por verificación KYC,
    // AccessDenied.Unpurchased, sin fecha de resolución) — ninguno se borra, solo cambia
    // el orden de intento. generateVideoWithFallbacks salta cualquier proveedor sin API
    // key configurada y solo pasa al siguiente si el anterior falla de verdad.
    const { videoUrl: generatedVideoUrl, model: usedVideoModel } = await generateVideoWithFallbacks([
      {
        label: `PiAPI ${PIAPI_MODEL}`,
        model: PIAPI_MODEL,
        enabled: Boolean(env.PIAPI_API_KEY),
        generate: () => generateVideoWithPiapi(env, job.imageUrl, animationPrompt),
      },
      {
        label: `Apiframe ${APIFRAME_MODEL}`,
        model: `apiframe-${APIFRAME_MODEL}`,
        enabled: Boolean(env.APIFRAME_API_KEY),
        generate: () => generateVideoWithApiframe(env, job.imageUrl, animationPrompt),
      },
      {
        label: `DashScope ${DASHSCOPE_MODEL}`,
        model: DASHSCOPE_MODEL,
        enabled: Boolean(env.DASHSCOPE_API_KEY),
        generate: () => generateVideoWithDashScope(env, job.imageUrl, animationPrompt),
      },
    ]);
    // Los 3 proveedores están configurados para pedir un clip de 5s (ver
    // PIAPI_VIDEO_DURATION_SECONDS / APIFRAME_VIDEO_DURATION_SECONDS / el `duration: 5`
    // hardcodeado en generateVideoWithDashScope) — de ahí la constante compartida aquí.
    void reportSocialflowAiUsage({
      tenantId: job.tenantId,
      agent: "VideoIA",
      model: usedVideoModel,
      durationSeconds: 5,
    });

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
          piapi: env.PIAPI_API_KEY ? "connected" : "missing",
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

  async scheduled(event: ScheduledEvent, env: DracoEnv, _ctx: ExecutionContext): Promise<void> {
    setGlobalEnv(env);

    // Nivel 3 — auto-aprobación con ventana de veto (tenant interno), cron separado
    // en el mismo worker (misma entrada [[triggers]] crons, distinguida por
    // event.cron). No toca la rama de processScheduledPosts() de abajo.
    if (event.cron === "*/15 * * * *") {
      try {
        const result = await runTrendAutoApproveCron(env);
        console.log("[TrendAutoApprove] Batch complete", JSON.stringify(result));
      } catch (error) {
        console.error("[TrendAutoApprove] runTrendAutoApproveCron failed", error instanceof Error ? error.message : String(error));
      }
      return;
    }

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
