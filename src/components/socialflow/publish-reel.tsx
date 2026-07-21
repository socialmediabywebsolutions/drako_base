"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReelsCreator, { fetchCaption } from "./reels-creator";
import { ReelsEngine, type ReelsConfig } from "@/lib/socialflow/reels/ReelsEngine";
import { CanvasRenderer } from "@/lib/socialflow/reels/CanvasRenderer";

type Phase = "idle" | "uploading" | "creating" | "error" | "batch-review" | "batch-items";

type ReelItemStep = "queued" | "generating" | "ready" | "saving" | "saved" | "error";

type ReelBatchItem = {
  id: string;
  file: File;
  sourcePreviewUrl: string;    // blob URL de la foto original — thumbnail mientras se genera
  videoBlobUrl: string | null; // blob URL del MP4 renderizado — preview una vez listo
  videoUrl: string | null;     // URL pública en R2 del MP4 — imageHint al guardar
  step: ReelItemStep;
  error: string | null;
  editBody: string;
  editHashtags: string[];
  editDate: string;            // YYYY-MM-DD
  editTime: string;            // HH:MM
  isEditing: boolean;
  savedAt: string | null;
};

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function toIsoString(date: string, time: string): string {
  return `${date}T${time || "09:00"}:00.000Z`;
}
function parseDate(iso: string): string {
  return iso.slice(0, 10);
}
function parseTime(iso: string): string {
  return iso.slice(11, 16);
}
function displayDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function IcoUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  );
}
function Spinner({ sm }: { sm?: boolean }) {
  return (
    <svg className={`animate-spin text-violet-400 ${sm ? "h-4 w-4" : "h-6 w-6"}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
function IcoCheck({ sm }: { sm?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={sm ? "h-3.5 w-3.5" : "h-4 w-4"}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
function IcoPencil() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
    </svg>
  );
}
function IcoX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}
function IcoCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}

async function uploadFile(file: File): Promise<{ url: string; key: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/socialflow/media/upload", { method: "POST", body: form });
  const data = (await res.json()) as { url?: string; key?: string; message?: string; error?: string };
  if (!res.ok || !data.url || !data.key) {
    throw new Error(data.message ?? data.error ?? "Error al subir el archivo.");
  }
  return { url: data.url, key: data.key };
}

// Decide config → renderiza el MP4 (Canvas/WebCodecs) → sube el vídeo → pide caption real
// — todo lo mismo que hace ReelsCreator.run(), pero como función plana reutilizable en la
// cola secuencial del batch. NO publica: devuelve los datos para que el usuario los
// revise/edite antes de aprobar, igual que UploadToPost.
async function generateReelForReview(
  file: File,
  saasId: string,
  batchIndex: number,
): Promise<{ videoBlobUrl: string; videoUrl: string; body: string; hashtags: string[]; scheduledAt: string }> {
  const { url: imageUrl, key: imageKey } = await uploadFile(file);

  const genRes = await fetch("/api/socialflow/reels/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl, saasId }),
  });
  const genData = (await genRes.json()) as { config?: ReelsConfig; message?: string; code?: string };
  if (!genRes.ok || !genData.config) {
    throw new Error(genData.message ?? genData.code ?? "No se pudo decidir la configuración del Reel.");
  }

  const engine = new ReelsEngine(new CanvasRenderer());
  const [blob, suggestedPost] = await Promise.all([
    engine.generate(genData.config),
    fetchCaption(imageUrl, imageKey, saasId, { batchIndex, scheduleIndex: batchIndex }),
  ]);

  const videoBlobUrl = URL.createObjectURL(blob);

  const form = new FormData();
  form.append("file", new File([blob], "reel.mp4", { type: "video/mp4" }));
  const uploadRes = await fetch("/api/socialflow/media/upload", { method: "POST", body: form });
  const uploadData = (await uploadRes.json()) as { url?: string; message?: string; error?: string };
  if (!uploadRes.ok || !uploadData.url) {
    throw new Error(uploadData.message ?? uploadData.error ?? "No se pudo subir el vídeo.");
  }

  const fallbackCaption = genData.config.textOverlays[0]?.text || "Reel";
  return {
    videoBlobUrl,
    videoUrl: uploadData.url,
    body: suggestedPost?.body ?? fallbackCaption,
    hashtags: suggestedPost?.hashtags ?? [],
    scheduledAt: suggestedPost?.scheduledAt ?? new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

// ── Item card (modo batch) ───────────────────────────────────────────────────────

function ReelItemCard({
  item,
  onUpdate,
  onRemove,
  onApprove,
}: {
  item: ReelBatchItem;
  onUpdate: (id: string, patch: Partial<ReelBatchItem>) => void;
  onRemove: (id: string) => void;
  onApprove: (id: string) => void;
}) {
  if (item.step === "queued" || item.step === "generating") {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/3">
        <div className="relative h-40 overflow-hidden bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.sourcePreviewUrl} alt="" className="h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Spinner />
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm font-medium text-white/50">
            {item.step === "queued" ? "En cola…" : "Generando Reel…"}
          </p>
        </div>
      </div>
    );
  }

  if (item.step === "error") {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border border-rose-500/20 bg-rose-500/5">
        <div className="relative h-40 overflow-hidden bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.sourcePreviewUrl} alt="" className="h-full w-full object-cover opacity-40" />
        </div>
        <div className="flex flex-col gap-3 px-4 py-3">
          <p className="text-xs leading-relaxed text-rose-300">{item.error}</p>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="flex items-center gap-1.5 self-start rounded-lg border border-rose-500/25 px-3 py-1.5 text-xs text-rose-400 transition hover:bg-rose-500/10"
          >
            <IcoX /> Eliminar
          </button>
        </div>
      </div>
    );
  }

  if (item.step === "saving" || item.step === "saved") {
    return (
      <div
        className={`flex flex-col overflow-hidden rounded-2xl border ${
          item.step === "saved" ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/8 bg-white/3"
        }`}
      >
        <div className="relative h-40 overflow-hidden bg-black/20">
          <video src={item.videoBlobUrl ?? undefined} className="h-full w-full object-cover opacity-60" muted />
          <div className="absolute inset-0 flex items-center justify-center">
            {item.step === "saving" ? (
              <Spinner />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
                <IcoCheck />
              </div>
            )}
          </div>
        </div>
        <div className="px-4 py-3">
          <p className={`text-sm font-semibold ${item.step === "saved" ? "text-emerald-300" : "text-white/50"}`}>
            {item.step === "saved" ? "Programado" : "Programando…"}
          </p>
          {item.savedAt && (
            <p className="mt-0.5 text-xs text-white/35">
              {displayDate(item.savedAt)} · {item.savedAt.slice(11, 16)}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── ready (compact view) ───────────────────────────────────────────────────
  if (!item.isEditing) {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/3">
        <div className="relative h-40 w-full overflow-hidden bg-black/20">
          <video src={item.videoBlobUrl ?? undefined} controls playsInline className="h-full w-full object-cover" />
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          {item.error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{item.error}</p>}

          <p className="line-clamp-3 text-sm leading-relaxed text-white/70">{item.editBody}</p>

          {item.editHashtags.length > 0 && (
            <span className="w-fit rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-medium text-violet-300">
              {item.editHashtags.length} hashtags
            </span>
          )}

          {item.editDate && (
            <p className="flex items-center gap-1.5 text-xs text-white/35">
              <IcoCalendar />
              {displayDate(item.editDate)} · {item.editTime || "09:00"}
            </p>
          )}

          <div className="mt-auto flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/35 transition hover:border-rose-500/30 hover:text-rose-400"
            >
              <IcoX />
            </button>
            <button
              type="button"
              onClick={() => onUpdate(item.id, { isEditing: true })}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/45 transition hover:bg-white/5 hover:text-white/70"
            >
              <IcoPencil /> Editar
            </button>
            <button
              type="button"
              onClick={() => onApprove(item.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
            >
              <IcoCheck sm /> Aprobar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ready (edit view) ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-violet-500/20 bg-white/3">
      <div className="relative h-24 overflow-hidden bg-black/20">
        <video src={item.videoBlobUrl ?? undefined} className="h-full w-full object-cover opacity-70" muted />
        <button
          type="button"
          onClick={() => onUpdate(item.id, { isEditing: false })}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white/60 backdrop-blur-sm transition hover:bg-white/20"
        >
          <IcoX /> Cerrar
        </button>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/25">Caption</p>
          <textarea
            value={item.editBody}
            onChange={(e) => onUpdate(item.id, { editBody: e.target.value })}
            rows={5}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm leading-relaxed text-white/80 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
        </div>

        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/25">
            Hashtags ({item.editHashtags.length}/15)
          </p>
          <textarea
            value={item.editHashtags.join(" ")}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (!raw) { onUpdate(item.id, { editHashtags: [] }); return; }
              const tags = raw.split(/\s+/).map((t) => (t.startsWith("#") ? t : `#${t}`)).slice(0, 15);
              onUpdate(item.id, { editHashtags: tags });
            }}
            rows={2}
            placeholder="#hashtag1 #hashtag2 …"
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={item.editDate}
            min={todayStr()}
            onChange={(e) => onUpdate(item.id, { editDate: e.target.value })}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
          <input
            type="time"
            value={item.editTime}
            onChange={(e) => onUpdate(item.id, { editTime: e.target.value })}
            className="w-28 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => onUpdate(item.id, { isEditing: false })}
            className="flex-1 rounded-lg border border-white/10 py-2 text-xs text-white/40 transition hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onApprove(item.id)}
            disabled={!item.editDate || !item.editBody.trim()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IcoCheck sm /> Aprobar
          </button>
        </div>
      </div>
    </div>
  );
}

// Dropzone de 1-maxImages fotos (límite dinámico: plan × días del mes, ver
// getUploadBatchLimit): 1 foto delega en ReelsCreator tal cual (preview + aprobar
// manual); 2+ fotos entran en modo batch — genera cada Reel secuencialmente (el render
// de Canvas consume mucha CPU como para paralelizarlo) y muestra una pantalla de
// revisión igual que UploadToPost: preview de vídeo, caption/hashtags/hora editables,
// aprobar/rechazar por Reel o "Aprobar todos". Nada se programa hasta que el usuario
// aprueba explícitamente.
export default function PublishReel({ saasId, maxImages }: { saasId: string; maxImages: number }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState<string | null>(null);

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [reelItems, setReelItems] = useState<ReelBatchItem[]>([]);

  const readyCount = reelItems.filter((i) => i.step === "ready").length;
  const allSaved = reelItems.length > 0 && reelItems.every((i) => i.step === "saved");

  useEffect(() => {
    if (!allSaved) return;
    const t = setTimeout(() => router.push("/socialflow/plan"), 2500);
    return () => clearTimeout(t);
  }, [allSaved, router]);

  function updateReelItem(id: string, patch: Partial<ReelBatchItem>) {
    setReelItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function reset() {
    reelItems.forEach((i) => {
      URL.revokeObjectURL(i.sourcePreviewUrl);
      if (i.videoBlobUrl) URL.revokeObjectURL(i.videoBlobUrl);
    });
    setPhase("idle");
    setError(null);
    setImageUrl(null);
    setImageKey(null);
    setPendingFiles([]);
    setReelItems([]);
  }

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Solo se aceptan imágenes.");
      setPhase("error");
      return;
    }

    setError(null);
    setPhase("uploading");
    try {
      const { url, key } = await uploadFile(file);
      setImageUrl(url);
      setImageKey(key);
      setPhase("creating");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
      setPhase("error");
    }
  }

  function handleFiles(fileList: FileList | File[]) {
    setError(null);
    const files = Array.from(fileList);
    const images = files.filter((f) => f.type.startsWith("image/"));

    if (files.length > images.length) {
      setError("Los vídeos todavía no están soportados como origen de Reel (próximamente) — se ignoraron.");
    }
    if (images.length === 0) return;

    const toProcess = images.slice(0, maxImages);
    if (images.length > maxImages) {
      setError(`Solo se procesarán ${maxImages} fotos (límite alcanzado).`);
    }

    if (toProcess.length === 1) {
      void handleFile(toProcess[0]);
      return;
    }

    setPendingFiles(toProcess);
    setPhase("batch-review");
  }

  async function runBatch() {
    const initialItems: ReelBatchItem[] = pendingFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      sourcePreviewUrl: URL.createObjectURL(file),
      videoBlobUrl: null,
      videoUrl: null,
      step: "queued",
      error: null,
      editBody: "",
      editHashtags: [],
      editDate: "",
      editTime: "",
      isEditing: false,
      savedAt: null,
    }));
    setReelItems(initialItems);
    setPhase("batch-items");

    for (let i = 0; i < initialItems.length; i++) {
      const item = initialItems[i];
      updateReelItem(item.id, { step: "generating" });
      try {
        const result = await generateReelForReview(item.file, saasId, i);
        updateReelItem(item.id, {
          step: "ready",
          videoBlobUrl: result.videoBlobUrl,
          videoUrl: result.videoUrl,
          editBody: result.body,
          editHashtags: result.hashtags,
          editDate: parseDate(result.scheduledAt),
          editTime: parseTime(result.scheduledAt),
        });
      } catch (e) {
        updateReelItem(item.id, { step: "error", error: e instanceof Error ? e.message : "Error inesperado." });
      }
    }
  }

  async function approveReelItem(id: string): Promise<void> {
    const item = reelItems.find((i) => i.id === id);
    if (!item || item.step !== "ready" || !item.videoUrl) return;

    updateReelItem(id, { step: "saving" });
    try {
      const title = item.editBody.split("\n")[0]?.replace(/^#+\s*/, "").slice(0, 72).trim() || "Reel";
      const bodyWithHashtags = item.editHashtags.length
        ? `${item.editBody}\n\n${item.editHashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
        : item.editBody;
      const scheduledAt = toIsoString(item.editDate, item.editTime);

      const res = await fetch("/api/socialflow/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
          provider: "INSTAGRAM",
          contentType: "REEL",
          title,
          body: bodyWithHashtags,
          imageHint: item.videoUrl,
          status: "SCHEDULED",
          scheduledAt,
        }),
      });
      const data = (await res.json()) as { post?: { id: string }; message?: string; code?: string };
      if (!res.ok || !data.post) throw new Error(data.message ?? data.code ?? "No se pudo programar el Reel.");

      updateReelItem(id, { step: "saved", savedAt: scheduledAt });
    } catch (e) {
      updateReelItem(id, { step: "ready", error: e instanceof Error ? e.message : "Error al guardar." });
    }
  }

  async function approveAllReels(): Promise<void> {
    const readyIds = reelItems.filter((i) => i.step === "ready").map((i) => i.id);
    await Promise.all(readyIds.map((id) => approveReelItem(id)));
  }

  function removeReelItem(id: string) {
    setReelItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) {
        URL.revokeObjectURL(item.sourcePreviewUrl);
        if (item.videoBlobUrl) URL.revokeObjectURL(item.videoBlobUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }

  if (phase === "creating" && imageUrl && imageKey) {
    return <ReelsCreator imageUrl={imageUrl} imageKey={imageKey} saasId={saasId} onClose={reset} />;
  }

  if (phase === "batch-review") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-violet-500/20 bg-white/3 p-6 text-center">
          <p className="text-lg font-bold text-white">
            {pendingFiles.length} fotos seleccionadas → se generarán {pendingFiles.length} Reels
          </p>
          <p className="mt-1 text-sm text-white/50">
            Cada Reel se genera en secuencia y podrás revisar caption, hashtags y hora antes de programarlo.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => void runBatch()}
              className="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
            >
              Generar {pendingFiles.length} Reels
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-white/50 transition hover:text-white/70"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "batch-items") {
    if (allSaved) {
      return (
        <div className="flex flex-col items-center gap-6 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
            <IcoCheck />
          </div>
          <div className="text-center">
            <p className="text-xl font-black text-emerald-300">
              {reelItems.length === 1 ? "Reel programado" : `${reelItems.length} Reels programados`}
            </p>
            <p className="mt-1 text-sm text-white/40">Redirigiendo al calendario…</p>
          </div>
        </div>
      );
    }

    const generatingIndex = reelItems.findIndex((i) => i.step === "generating" || i.step === "queued");
    const generatedCount = reelItems.filter((i) => i.step !== "queued" && i.step !== "generating").length;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/3 px-4 py-3">
          <p className="text-sm text-white/60">
            {generatingIndex === -1
              ? `${generatedCount} de ${reelItems.length} Reels generados`
              : `Generando Reel ${generatingIndex + 1} de ${reelItems.length}…`}
          </p>
          {readyCount > 0 && (
            <button
              type="button"
              onClick={() => void approveAllReels()}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
            >
              <IcoCheck sm /> Aprobar todos ({readyCount})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reelItems.map((item) => (
            <ReelItemCard
              key={item.id}
              item={item}
              onUpdate={updateReelItem}
              onRemove={removeReelItem}
              onApprove={(id) => void approveReelItem(id)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => phase !== "uploading" && fileInputRef.current?.click()}
        className={[
          "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed p-16 text-center transition-all",
          isDragging
            ? "border-violet-500/60 bg-violet-500/10"
            : "border-white/12 bg-white/3 hover:border-violet-500/40 hover:bg-violet-500/5",
        ].join(" ")}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 text-violet-400">
          {phase === "uploading" ? <Spinner /> : <IcoUpload />}
        </div>
        <div>
          <p className="text-base font-bold text-white/80">
            {phase === "uploading" ? "Subiendo imagen…" : "Arrastra tus fotos aquí"}
          </p>
          {phase !== "uploading" && (
            <>
              <p className="mt-1 text-sm text-white/40">o haz click para seleccionar</p>
              <p className="mt-3 text-xs text-white/25">Hasta {maxImages} fotos · JPEG, PNG, WebP, GIF · máx. 200 MB</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
