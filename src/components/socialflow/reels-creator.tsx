"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ReelsEngine, type ReelsConfig } from "@/lib/socialflow/reels/ReelsEngine";
import { CanvasRenderer } from "@/lib/socialflow/reels/CanvasRenderer";

// Orquesta las 3 capas del Reels Engine desde el navegador (única forma posible —
// Canvas/WebCodecs no existen en el runtime de Cloudflare Workers, ver auditoría):
// 1) pide la config a /api/socialflow/reels/generate (Capa 3, servidor)
// 2) la renderiza en el navegador con CanvasRenderer (Capa 2)
// 3) sube el Blob resultante a /api/socialflow/media/upload (mismo endpoint que ya
//    acepta video/mp4 para el flujo de fotos)
// 4) al aprobar, programa el post vía /api/socialflow/posts con contentType "REEL".

type Phase = "deciding" | "rendering" | "uploading" | "ready" | "saving" | "saved" | "error";

export default function ReelsCreator({
  imageUrl,
  saasId,
  campaignId,
  onClose,
}: {
  imageUrl: string;
  saasId: string;
  campaignId?: string;
  onClose?: () => void;
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

      setPhase("rendering");
      setProgress(0);
      const engine = new ReelsEngine(new CanvasRenderer());
      const blob = await engine.generate(genData.config, (p) => setProgress(p));

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
    setPhase("saving");
    try {
      const caption = config.textOverlays[0]?.text || "Reel";
      const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const res = await fetch("/api/socialflow/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
          campaignId: campaignId ?? null,
          provider: "INSTAGRAM",
          contentType: "REEL",
          title: caption.slice(0, 72),
          body: caption,
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
