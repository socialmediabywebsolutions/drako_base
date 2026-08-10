"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ReelsEngine, type ReelsConfig } from "@/lib/socialflow/reels/ReelsEngine";
import { CanvasRenderer } from "@/lib/socialflow/reels/CanvasRenderer";

// Orquesta las 3 capas del Reels Engine desde el navegador (única forma posible —
// Canvas/WebCodecs no existen en el runtime de Cloudflare Workers, ver auditoría):
// 1) pide la config a /api/socialflow/reels/generate (Capa 3, servidor)
// 2) en paralelo: la renderiza en el navegador con CanvasRenderer (Capa 2) y pide
//    caption/hashtags/scheduledAt reales a /api/socialflow/posts/generate-from-image
//    (mismo pipeline LLaVA+Mistral que usa el flujo de fotos, ver auditoría) — un fallo
//    en el caption nunca debe tumbar el render del vídeo, por eso fetchCaption() nunca
//    rechaza la promesa, solo devuelve null.
// 3) sube el Blob resultante a /api/socialflow/media/upload (mismo endpoint que ya
//    acepta video/mp4 para el flujo de fotos)
// 4) al aprobar, programa el post vía /api/socialflow/posts con contentType "REEL",
//    usando el caption real si se consiguió, o el nombre de marca como fallback.

type Phase = "deciding" | "rendering" | "uploading" | "ready" | "saving" | "saved" | "error";

export type SuggestedPost = {
  title: string;
  body: string;
  hashtags: string[];
  scheduledAt: string;
  degraded?: boolean;
};

// batchIndex/scheduleIndex son opcionales y por defecto se omiten (el servidor los trata
// como 0) — mismo comportamiento de siempre para el flujo de 1 foto. El modo batch de
// PublishReel (2-maxImages fotos, límite dinámico por plan × días del mes) sí los pasa, incrementales por foto, para que
// generate-from-image reparta cada Reel en un día/hora distinto del calendario, igual
// que hace UploadToPost con sus fotos (ver auditoría).
export async function fetchCaption(
  imageUrl: string,
  imageKey: string,
  saasId: string,
  scheduling?: { batchIndex: number; scheduleIndex: number },
  userNote?: string,
  theme?: string,
): Promise<SuggestedPost | null> {
  try {
    const res = await fetch("/api/socialflow/posts/generate-from-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "finalize",
        imageUrl,
        imageKey,
        saasId,
        forcedContentType: "REEL",
        ...(scheduling ? { batchIndex: scheduling.batchIndex, scheduleIndex: scheduling.scheduleIndex } : {}),
        ...(userNote?.trim() ? { userNote: userNote.trim() } : {}),
        ...(theme && theme !== "auto" ? { carouselTheme: theme } : {}),
      }),
    });
    const data = (await res.json()) as { suggestedPost?: SuggestedPost };
    if (!res.ok || !data.suggestedPost) return null;
    return data.suggestedPost;
  } catch {
    return null;
  }
}

export type ReelApprovedResult = {
  videoUrl: string;
  suggestedPost: SuggestedPost | null;
  fallbackCaption: string;
};

export default function ReelsCreator({
  imageUrl,
  imageKey,
  saasId,
  campaignId,
  batchIndex,
  userNote,
  theme,
  onClose,
  onApproved,
  totalImagesInBatch,
  initialMode,
}: {
  imageUrl: string;
  imageKey: string;
  saasId: string;
  campaignId?: string;
  // Cuántas fotos seleccionó el cliente en total en esta sesión de subida — este
  // componente SIEMPRE procesa una sola (imageUrl), esto es solo para saber si hay que
  // avisar de que "Vídeo IA" usará únicamente la primera. Opcional, default 1 — lo pasa
  // upload-to-post.tsx (activeCount) desde cualquiera de los dos botones que abren este
  // modal ("🎬 Reel" y "🤖 Vídeo IA"); publish-reel.tsx todavía no lo conecta (su modo
  // batch de 2+ fotos no pasa por este componente, ver generateReelForReview).
  totalImagesInBatch?: number;
  // Posición de esta foto dentro de la tanda de subida — sin esto, fetchCaption()
  // omitía batchIndex/scheduleIndex y generate-from-image siempre calculaba el mismo
  // openerIndex (ver ContentGeneratorAgent), lo que hacía que varios Reels creados en
  // la misma sesión terminaran con captions muy parecidos o iguales. Opcional para no
  // romper ningún caller existente que aún no lo pase.
  batchIndex?: number;
  // Nota opcional del cliente ("¿qué estás haciendo en esta foto?") — prioridad
  // máxima en ContentValueAgent sobre la inferencia visual. Opcional, mismo criterio
  // que batchIndex: no rompe ningún caller que aún no lo pase.
  userNote?: string;
  // Tema elegido en el selector previo al dropzone (publish-reel.tsx) — mismo criterio
  // que userNote: opcional, no rompe ningún caller que aún no lo pase.
  theme?: string;
  // Si se pasa, se salta la pantalla "¿Cómo quieres crear este Reel?" y arranca esa
  // ruta directamente en el montaje — usado por el botón "🤖 Vídeo IA" del selector de
  // formato de UploadToPost para entrar sin el paso intermedio (ver auditoría FIX 3).
  // Opcional: sin este prop, el comportamiento es el de siempre (pantalla de elección).
  initialMode?: "effects" | "ai-video";
  onClose?: () => void;
  // Si se pasa, "Aprobar y programar" NO guarda el post aquí — solo entrega el vídeo y el
  // caption sugerido al padre (usado por upload-to-post.tsx / campaign-photo-batch.tsx para
  // que el Reel entre en su mismo pipeline de aprobación en vez de crear un post por su cuenta).
  // Sin este prop, el comportamiento es el de siempre (self-contained save).
  onApproved?: (result: ReelApprovedResult) => void;
}) {
  const router = useRouter();
  const startedRef = useRef(false);
  const previewUrlRef = useRef<string | null>(null);

  const [phase, setPhase] = useState<Phase>("deciding");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<ReelsConfig | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [suggestedPost, setSuggestedPost] = useState<SuggestedPost | null>(null);

  // Selector inicial — el cliente elige UNA de las dos rutas antes de que empiece
  // cualquier procesamiento (ni CanvasRenderer ni Vídeo IA arrancan solos al montar).
  type SelectedMode = "choosing" | "effects" | "ai-video";
  const [selectedMode, setSelectedMode] = useState<SelectedMode>("choosing");

  // Real Video Generation (alibaba/hh1-i2v) — flujo independiente del CanvasRenderer de
  // arriba: no comparte fase ni estado con `run()`/`approve()`, corre en su propio
  // worker dedicado (ver auditoría) vía job + polling, nunca bloquea ni depende del
  // render local.
  type AiVideoPhase = "idle" | "generating" | "ready" | "saving" | "saved" | "failed";
  const [aiVideoPhase, setAiVideoPhase] = useState<AiVideoPhase>("idle");
  const [aiVideoResultUrl, setAiVideoResultUrl] = useState<string | null>(null);
  const [aiVideoError, setAiVideoError] = useState<string | null>(null);
  // Caption/hashtags/narración/hora sugerida — los produce el consumer (ContentGeneratorAgent
  // + TTS, ver processAiVideoJob) y llegan ya listos en el polling de ai-video-status;
  // editables aquí antes de aprobar (a diferencia del flujo "efectos", que delega la
  // edición al padre — ver auditoría del rediseño de Vídeo IA).
  const [aiVideoCaption, setAiVideoCaption] = useState("");
  const [aiVideoHashtags, setAiVideoHashtags] = useState<string[]>([]);
  const [aiVideoNarrationUrl, setAiVideoNarrationUrl] = useState<string | null>(null);
  const [aiVideoSuggestedScheduledAt, setAiVideoSuggestedScheduledAt] = useState<string | null>(null);
  const aiVideoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aiVideoJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (aiVideoPollRef.current) clearInterval(aiVideoPollRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  // Si el caller ya sabe qué ruta quiere (botón "🤖 Vídeo IA" del selector de formato),
  // se salta la pantalla de elección y arranca directo — chooseMode ya protege contra
  // doble arranque con startedRef.
  useEffect(() => {
    if (initialMode) chooseMode(initialMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dispara UNA de las dos rutas — nunca ambas — según lo que elija el cliente en el
  // selector. startedRef evita doble arranque si el usuario hace doble clic.
  function chooseMode(mode: "effects" | "ai-video") {
    if (startedRef.current) return;
    startedRef.current = true;
    // Limpia cualquier error que hubiera quedado de un intento anterior — sin esto, un
    // error de efectos/vídeo IA de una sesión previa de este mismo modal podía seguir
    // visible tras elegir el otro modo.
    setError(null);
    setAiVideoError(null);
    setSelectedMode(mode);
    if (mode === "effects") {
      void run();
    } else {
      // El caption/hashtags ya no se piden aquí en paralelo — el consumer del job
      // (processAiVideoJob) los genera con ContentGeneratorAgent, con el análisis real
      // de la imagen de por medio, y llegan listos en el polling de ai-video-status.
      // Pedirlos también aquí sería repetir el mismo análisis+generación dos veces.
      void startAiVideoGeneration();
    }
  }

  async function run() {
    setError(null);
    setPhase("deciding");
    try {
      const genRes = await fetch("/api/socialflow/reels/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, saasId }),
      });
      const genData = (await genRes.json()) as { config?: ReelsConfig; message?: string; code?: string };
      if (!genRes.ok || !genData.config) {
        throw new Error(genData.message ?? genData.code ?? "No se pudo decidir la configuración del Reel.");
      }
      setConfig(genData.config);
      // TEMPORAL — depuración del bug de recorte vertical (mano cortada en fotos con
      // sujeto asimétrico en Y). Quitar una vez confirmado qué template/efectos le tocan
      // a un Reel real. No dejar en producción.
      console.log("[ReelsCreator DEBUG] template:", genData.config.template);
      console.log("[ReelsCreator DEBUG] effects:", genData.config.effects.map((e) => e.kind));
      console.log("[ReelsCreator DEBUG] handle:", genData.config.handle);

      setPhase("rendering");
      setProgress(0);
      const engine = new ReelsEngine(new CanvasRenderer());
      const [blob, suggestedPostResult] = await Promise.all([
        engine.generate(genData.config, (p) => setProgress(p)),
        fetchCaption(
          imageUrl,
          imageKey,
          saasId,
          typeof batchIndex === "number" ? { batchIndex, scheduleIndex: batchIndex } : undefined,
          userNote,
          theme,
        ),
      ]);
      setSuggestedPost(suggestedPostResult);

      const objectUrl = URL.createObjectURL(blob);
      previewUrlRef.current = objectUrl;
      setPreviewUrl(objectUrl);

      setPhase("uploading");
      const form = new FormData();
      form.append("file", new File([blob], "reel.mp4", { type: "video/mp4" }));
      const uploadRes = await fetch("/api/socialflow/media/upload", { method: "POST", body: form });
      const uploadData = (await uploadRes.json()) as { url?: string; message?: string; error?: string };
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.message ?? uploadData.error ?? "No se pudo subir el vídeo.");
      }

      setVideoUrl(uploadData.url);
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado generando el Reel.");
      setPhase("error");
    }
  }

  async function approve() {
    if (!videoUrl || !config) return;

    // Fallback si generate-from-image falló o nunca respondió: nombre de marca + 1h.
    const fallbackCaption = config.textOverlays[0]?.text || "Reel";

    if (onApproved) {
      onApproved({ videoUrl, suggestedPost, fallbackCaption });
      return;
    }

    setPhase("saving");
    try {
      const body = suggestedPost
        ? suggestedPost.hashtags.length
          ? `${suggestedPost.body}\n\n${suggestedPost.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
          : suggestedPost.body
        : fallbackCaption;
      const title = (suggestedPost?.title || fallbackCaption).slice(0, 72);
      const scheduledAt = suggestedPost?.scheduledAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const res = await fetch("/api/socialflow/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
          campaignId: campaignId ?? null,
          provider: "INSTAGRAM",
          contentType: "REEL",
          title,
          body,
          imageHint: videoUrl,
          status: "SCHEDULED",
          scheduledAt,
        }),
      });
      const data = (await res.json()) as { post?: { id: string }; message?: string; code?: string };
      if (!res.ok || !data.post) throw new Error(data.message ?? data.code ?? "No se pudo programar el Reel.");

      setPhase("saved");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al programar el Reel.");
      setPhase("ready");
    }
  }

  async function startAiVideoGeneration() {
    setAiVideoError(null);
    setAiVideoPhase("generating");
    try {
      const res = await fetch("/api/socialflow/reels/generate-ai-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, imageKey, saasId }),
      });
      const data = (await res.json()) as { jobId?: string; message?: string; error?: string };
      if (!res.ok || !data.jobId) {
        throw new Error(data.message ?? data.error ?? "No se pudo iniciar la generación de vídeo IA.");
      }

      const jobId = data.jobId;
      aiVideoJobIdRef.current = jobId;
      aiVideoPollRef.current = setInterval(() => {
        void (async () => {
          try {
            const statusRes = await fetch(`/api/socialflow/reels/ai-video-status/${jobId}`);
            const statusData = (await statusRes.json()) as {
              ok?: boolean;
              job?: {
                status: string;
                videoUrl: string | null;
                error: string | null;
                caption: string | null;
                hashtags: string[];
                narrationUrl: string | null;
                suggestedScheduledAt: string | null;
              };
            };
            if (!statusRes.ok || !statusData.job) return;

            if (statusData.job.status === "completed" && statusData.job.videoUrl) {
              if (aiVideoPollRef.current) clearInterval(aiVideoPollRef.current);
              setError(null);
              setAiVideoResultUrl(statusData.job.videoUrl);
              setAiVideoCaption(statusData.job.caption?.trim() ?? "");
              setAiVideoHashtags(statusData.job.hashtags ?? []);
              setAiVideoNarrationUrl(statusData.job.narrationUrl);
              setAiVideoSuggestedScheduledAt(statusData.job.suggestedScheduledAt);
              setAiVideoPhase("ready");
            } else if (statusData.job.status === "failed") {
              if (aiVideoPollRef.current) clearInterval(aiVideoPollRef.current);
              setAiVideoError(statusData.job.error ?? "La generación de vídeo IA falló.");
              setAiVideoPhase("failed");
            }
            // "pending"/"processing" — sigue el polling, nada que hacer todavía.
          } catch {
            // Un fallo puntual de red en un tick de polling no cancela el intento —
            // el intervalo sigue reintentando cada 5s hasta completed/failed.
          }
        })();
      }, 5000);
    } catch (e) {
      setAiVideoError(e instanceof Error ? e.message : "Error inesperado iniciando el vídeo IA.");
      setAiVideoPhase("failed");
    }
  }

  // Mismo flujo de publicación que approve() (onApproved del padre, o self-contained
  // save a /api/socialflow/posts) — separado en vez de reutilizar approve() para no
  // acoplar dos pipelines independientes (CanvasRenderer exige `config`, este no).
  // Usa aiVideoCaption/aiVideoHashtags (editables por el cliente, precargados desde el
  // job) en vez de `suggestedPost` — ese state es del flujo "efectos", el de Vídeo IA ya
  // no lo rellena (ver chooseMode).
  async function publishAiVideo() {
    if (!aiVideoResultUrl) return;

    const fallbackCaption = "Reel";
    const caption = aiVideoCaption.trim() || fallbackCaption;
    const scheduledAt = aiVideoSuggestedScheduledAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const aiVideoSuggestedPost: SuggestedPost = {
      title: caption.slice(0, 72),
      body: caption,
      hashtags: aiVideoHashtags,
      scheduledAt,
      degraded: false,
    };

    if (onApproved) {
      onApproved({ videoUrl: aiVideoResultUrl, suggestedPost: aiVideoSuggestedPost, fallbackCaption });
      return;
    }

    setAiVideoPhase("saving");
    try {
      const body = aiVideoHashtags.length
        ? `${caption}\n\n${aiVideoHashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
        : caption;

      const res = await fetch("/api/socialflow/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
          campaignId: campaignId ?? null,
          provider: "INSTAGRAM",
          contentType: "REEL",
          title: aiVideoSuggestedPost.title,
          body,
          imageHint: aiVideoResultUrl,
          status: "SCHEDULED",
          scheduledAt,
          metadata: aiVideoNarrationUrl ? { narrationUrl: aiVideoNarrationUrl } : undefined,
        }),
      });
      const data = (await res.json()) as { post?: { id: string }; message?: string; code?: string };
      if (!res.ok || !data.post) throw new Error(data.message ?? data.code ?? "No se pudo programar el Reel.");

      setAiVideoPhase("saved");
      router.refresh();
    } catch (e) {
      setAiVideoError(e instanceof Error ? e.message : "Error al programar el Reel.");
      setAiVideoPhase("ready");
    }
  }

  // Descarta el job de Vídeo IA — borra la fila en DB (no queda nada que programar) y
  // resetea el estado local. DELETE nunca lanza fuera de sí misma en el cliente: un
  // fallo de red al borrar no debe impedir cerrar el modal, el peor caso es una fila
  // huérfana en socialflow_ai_video_jobs, no un post publicado por error.
  async function discardAiVideo() {
    const jobId = aiVideoJobIdRef.current;
    setAiVideoPhase("idle");
    setAiVideoResultUrl(null);
    setAiVideoCaption("");
    setAiVideoHashtags([]);
    setAiVideoNarrationUrl(null);
    setAiVideoSuggestedScheduledAt(null);
    if (jobId) {
      fetch(`/api/socialflow/reels/ai-video-status/${jobId}`, { method: "DELETE" }).catch(() => {});
    }
    onClose?.();
  }

  return (
    <div className="space-y-3 rounded-2xl border border-violet-500/20 bg-white/3 p-4">
      {selectedMode === "choosing" && (
        <div className="space-y-3">
          <p className="text-center text-xs font-semibold text-white/60">¿Cómo quieres crear este Reel?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => chooseMode("effects")}
              className="rounded-xl border border-violet-500/25 bg-violet-500/10 p-4 text-left transition hover:bg-violet-500/20"
            >
              <div className="text-sm font-bold text-violet-300">⚡ Reel con efectos</div>
              <p className="mt-1 text-xs text-white/50">Listo en segundos. Imagen animada con música y narración IA.</p>
            </button>
            <button
              type="button"
              onClick={() => chooseMode("ai-video")}
              className="rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/10 p-4 text-left transition hover:bg-fuchsia-500/20"
            >
              <div className="text-sm font-bold text-fuchsia-300">✨ Vídeo IA</div>
              <p className="mt-1 text-xs text-white/50">2-3 minutos. Movimiento real generado por IA.</p>
            </button>
          </div>
          {(totalImagesInBatch ?? 1) > 1 && (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300">
              El Vídeo IA procesa una imagen a la vez. Se usará la primera foto seleccionada.
            </p>
          )}
        </div>
      )}

      {selectedMode === "effects" && (
      <>
      {(phase === "deciding" || phase === "rendering" || phase === "uploading") && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-violet-400" />
          <p className="text-sm text-white/60">
            {phase === "deciding" && "Decidiendo plantilla y efectos con IA…"}
            {phase === "rendering" && "Renderizando el vídeo en tu navegador…"}
            {phase === "uploading" && "Subiendo el vídeo…"}
          </p>
          {phase === "rendering" && (
            <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {phase === "error" && (
        <div className="space-y-3">
          <p className="text-xs text-rose-300">{error}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void run()}
              className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-violet-400"
            >
              Reintentar
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:text-white/70"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {(phase === "ready" || phase === "saving") && previewUrl && (
        <div className="space-y-3">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={previewUrl}
            controls
            playsInline
            className="mx-auto h-96 max-w-full rounded-xl border border-white/10 bg-black"
          />
          {config?.narrationTrackUrl && (
            <div className="flex justify-center">
              <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-[11px] font-medium text-violet-300">
                🎙 Narración IA
              </span>
            </div>
          )}
          {error && <p className="text-xs text-rose-300">{error}</p>}
          {suggestedPost?.degraded && (
            <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              ⚠️ No pudimos analizar bien el contenido de este archivo — revisa el texto generado antes de aprobar.
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={phase === "saving"}
              onClick={() => void approve()}
              className="flex-1 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 py-2 text-xs font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              {phase === "saving" ? "Programando…" : "Aprobar y programar"}
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={phase === "saving"}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 transition hover:text-white/70 disabled:opacity-50"
              >
                Descartar
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "saved" && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
            ✓ Reel programado
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:text-white/70"
            >
              Cerrar
            </button>
          )}
        </div>
      )}

      </>
      )}

      {/* Vídeo IA (alibaba/hh1-i2v) — elegido en el selector de arriba (o vía initialMode,
          que se salta esa pantalla), dispara startAiVideoGeneration() desde chooseMode();
          nunca queda en "idle" visible. */}
      {selectedMode === "ai-video" && (
      <div className="space-y-2 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-3">
        {/* Mismo aviso que en la pantalla de elección — necesario aquí también porque
            initialMode="ai-video" se la salta y este es el único punto donde el cliente
            ve el aviso en ese caso. */}
        {(totalImagesInBatch ?? 1) > 1 && (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300">
            El Vídeo IA procesa una imagen a la vez. Se usará la primera foto seleccionada.
          </p>
        )}
        {aiVideoPhase === "generating" && (
          <div className="flex items-center justify-center gap-2 py-3 text-center">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-fuchsia-300/30 border-t-fuchsia-300" />
            <p className="text-xs text-white/60">Generando vídeo IA…</p>
          </div>
        )}

        {(aiVideoPhase === "ready" || aiVideoPhase === "saving") && aiVideoResultUrl && (
          <div className="space-y-3">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              src={aiVideoResultUrl}
              controls
              playsInline
              className="mx-auto h-72 max-w-full rounded-xl border border-white/10 bg-black"
            />

            {aiVideoNarrationUrl && (
              <div className="flex justify-center">
                <span className="rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-[11px] font-medium text-violet-300">
                  🎙 Narración IA
                </span>
              </div>
            )}

            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/25">Caption</p>
              <textarea
                value={aiVideoCaption}
                onChange={(e) => setAiVideoCaption(e.target.value)}
                rows={4}
                disabled={aiVideoPhase === "saving"}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm leading-relaxed text-white/80 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/50 disabled:opacity-50"
              />
            </div>

            <div>
              <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/25">
                Hashtags ({aiVideoHashtags.length}/15)
              </p>
              <textarea
                value={aiVideoHashtags.join(" ")}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (!raw) { setAiVideoHashtags([]); return; }
                  setAiVideoHashtags(raw.split(/\s+/).map((t) => (t.startsWith("#") ? t : `#${t}`)).slice(0, 15));
                }}
                rows={2}
                placeholder="#hashtag1 #hashtag2 …"
                disabled={aiVideoPhase === "saving"}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/50 disabled:opacity-50"
              />
            </div>

            {aiVideoError && <p className="text-xs text-rose-300">{aiVideoError}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={aiVideoPhase === "saving"}
                onClick={() => void publishAiVideo()}
                className="flex-1 rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-500 py-2 text-xs font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
              >
                {aiVideoPhase === "saving" ? "Programando…" : "Aprobar y programar"}
              </button>
              <button
                type="button"
                onClick={() => void discardAiVideo()}
                disabled={aiVideoPhase === "saving"}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50 transition hover:text-white/70 disabled:opacity-50"
              >
                Descartar
              </button>
            </div>
          </div>
        )}

        {aiVideoPhase === "saved" && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
              ✓ Reel programado
            </span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="mt-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:text-white/70"
              >
                Cerrar
              </button>
            )}
          </div>
        )}

        {aiVideoPhase === "failed" && (
          <div className="space-y-2 text-center">
            <p className="text-xs text-rose-300">{aiVideoError}</p>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => void startAiVideoGeneration()}
                className="rounded-lg bg-fuchsia-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-fuchsia-400"
              >
                Reintentar
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:text-white/70"
                >
                  Cancelar
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
