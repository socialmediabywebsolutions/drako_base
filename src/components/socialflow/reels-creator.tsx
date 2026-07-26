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
  onClose,
  onApproved,
}: {
  imageUrl: string;
  imageKey: string;
  saasId: string;
  campaignId?: string;
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

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void run();
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        fetchCaption(imageUrl, imageKey, saasId),
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

  return (
    <div className="space-y-3 rounded-2xl border border-violet-500/20 bg-white/3 p-4">
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
          {error && <p className="text-xs text-rose-300">{error}</p>}
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
    </div>
  );
}
