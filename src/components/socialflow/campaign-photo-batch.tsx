"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ImageAnalysis } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";

// Shared upload/analyze/finalize/approve pipeline behind CampaignPhotoUpload (legacy "Subir fotos"
// button, autoProcess: true — analiza cada foto en cuanto se sube, sin cambios de comportamiento)
// and CreateCampaignWizard's step 2/3 (autoProcess: false — solo sube en el paso 2; el análisis +
// generación coordinada de todo el lote se dispara una vez desde confirmAndGenerate() en el paso 3).

export type ContentCategory = "foto_real" | "grafico_texto";
export type ItemStep = "uploading" | "uploaded" | "analyzing" | "ready" | "saving" | "saved" | "error";

export type UploadItem = {
  id: string;
  file: File;
  localPreviewUrl: string;
  r2Url: string | null;
  r2Key: string | null;
  batchIndex: number;
  step: ItemStep;
  error: string | null;
  imageAnalysis: ImageAnalysis | null;
  contentCategory: ContentCategory | null;
  editBody: string;
  editHashtags: string[];
  editDate: string;
  editTime: string;
  editContentType: string;
  editProvider: string;
  savedAt: string | null;
};

export const CONTENT_TYPE_LABELS: Record<string, string> = { FEED: "Feed", REEL: "Reel", STORY: "Story" };
export const PROVIDER_LABELS: Record<string, string> = { INSTAGRAM: "Instagram", LINKEDIN: "LinkedIn" };

export function parseDate(iso: string): string {
  return iso.slice(0, 10);
}
export function parseTime(iso: string): string {
  return iso.slice(11, 16);
}
export function toIsoString(date: string, time: string): string {
  return `${date}T${time || "09:00"}:00.000Z`;
}
export function displayDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// Intercala foto_real/grafico_texto para que el calendario alterne tipos de contenido,
// independientemente del orden en que se subieron.
export function interleaveByCategory<T extends { contentCategory: ContentCategory | null }>(list: T[]): T[] {
  const fotos = list.filter((i) => i.contentCategory === "foto_real");
  const graficos = list.filter((i) => i.contentCategory === "grafico_texto");
  const merged: T[] = [];
  let fi = 0;
  let gi = 0;
  while (fi < fotos.length || gi < graficos.length) {
    if (fi < fotos.length) merged.push(fotos[fi++]);
    if (gi < graficos.length) merged.push(graficos[gi++]);
  }
  return merged;
}

type UseCampaignPhotoBatchArgs = {
  campaignId: string;
  saasId: string;
  maxImages: number;
  autoProcess: boolean;
};

export function useCampaignPhotoBatch({ campaignId, saasId, maxImages, autoProcess }: UseCampaignPhotoBatchArgs) {
  const router = useRouter();
  const [items, setItems] = useState<UploadItem[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const activeCount = items.filter((i) => i.step !== "error").length;
  const uploadedCount = items.filter((i) => i.step === "uploaded").length;
  const readyCount = items.filter((i) => i.step === "ready").length;
  const savedCount = items.filter((i) => i.step === "saved").length;

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function uploadToR2(
    file: File,
    batchIndex: number,
  ): Promise<{ id: string; r2Url: string; r2Key: string; batchIndex: number } | null> {
    const id = crypto.randomUUID();
    const localPreviewUrl = URL.createObjectURL(file);

    setItems((prev) => [
      ...prev,
      {
        id, file, localPreviewUrl, r2Url: null, r2Key: null, batchIndex,
        step: "uploading", error: null, imageAnalysis: null, contentCategory: null,
        editBody: "", editHashtags: [], editDate: "", editTime: "",
        editContentType: "FEED", editProvider: "INSTAGRAM", savedAt: null,
      },
    ]);

    try {
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/socialflow/media/upload", { method: "POST", body: form });
      const uploadData = (await uploadRes.json()) as { url?: string; key?: string; message?: string; error?: string };
      if (!uploadRes.ok || !uploadData.url || !uploadData.key) {
        throw new Error(uploadData.message ?? uploadData.error ?? "Error al subir la imagen.");
      }
      updateItem(id, { r2Url: uploadData.url, r2Key: uploadData.key, step: "uploaded" });
      return { id, r2Url: uploadData.url, r2Key: uploadData.key, batchIndex };
    } catch (e) {
      updateItem(id, { step: "error", error: e instanceof Error ? e.message : "Error inesperado." });
      return null;
    }
  }

  async function analyzePhoto(item: {
    id: string;
    r2Url: string;
    r2Key: string;
    batchIndex: number;
  }): Promise<
    | { id: string; r2Url: string; r2Key: string; imageAnalysis: ImageAnalysis; contentCategory: ContentCategory; batchIndex: number }
    | null
  > {
    updateItem(item.id, { step: "analyzing" });
    try {
      const analyzeRes = await fetch(`/api/socialflow/campaigns/${campaignId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: item.r2Url, imageKey: item.r2Key, saasId, mode: "analyze" }),
      });
      const analyzeData = (await analyzeRes.json()) as {
        imageAnalysis?: ImageAnalysis;
        contentCategory?: ContentCategory;
        code?: string; message?: string;
      };
      if (!analyzeRes.ok || !analyzeData.imageAnalysis || !analyzeData.contentCategory) {
        throw new Error(analyzeData.message ?? analyzeData.code ?? "Error al analizar la imagen.");
      }
      updateItem(item.id, { imageAnalysis: analyzeData.imageAnalysis, contentCategory: analyzeData.contentCategory });
      return {
        id: item.id,
        r2Url: item.r2Url,
        r2Key: item.r2Key,
        imageAnalysis: analyzeData.imageAnalysis,
        contentCategory: analyzeData.contentCategory,
        batchIndex: item.batchIndex,
      };
    } catch (e) {
      updateItem(item.id, { step: "error", error: e instanceof Error ? e.message : "Error inesperado." });
      return null;
    }
  }

  async function finalizePhoto(
    item: { id: string; r2Url: string; r2Key: string; imageAnalysis: ImageAnalysis; batchIndex: number },
    scheduleIndex: number,
  ): Promise<void> {
    try {
      const genRes = await fetch(`/api/socialflow/campaigns/${campaignId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: item.r2Url,
          imageKey: item.r2Key,
          saasId,
          imageAnalysis: item.imageAnalysis,
          batchIndex: item.batchIndex,
          scheduleIndex,
        }),
      });
      const genData = (await genRes.json()) as {
        suggestedPost?: { body: string; hashtags: string[]; scheduledAt: string; contentType: string; provider: string };
        code?: string; message?: string;
      };
      if (!genRes.ok || !genData.suggestedPost) {
        throw new Error(genData.message ?? genData.code ?? "Error al generar el post.");
      }

      updateItem(item.id, {
        step: "ready",
        editBody: genData.suggestedPost.body,
        editHashtags: genData.suggestedPost.hashtags,
        editDate: parseDate(genData.suggestedPost.scheduledAt),
        editTime: parseTime(genData.suggestedPost.scheduledAt),
        editContentType: genData.suggestedPost.contentType,
        editProvider: genData.suggestedPost.provider,
      });
    } catch (e) {
      updateItem(item.id, { step: "error", error: e instanceof Error ? e.message : "Error inesperado." });
    }
  }

  async function addFiles(newFiles: FileList | File[]) {
    setGlobalError(null);
    const files = Array.from(newFiles);
    const images = files.filter((f) => f.type.startsWith("image/"));
    const available = maxImages - activeCount;

    if (available <= 0) {
      setGlobalError(`Límite de ${maxImages} fotos alcanzado.`);
      return;
    }

    const toProcess = images.slice(0, available);
    if (files.length > images.length) {
      setGlobalError("Algunos archivos fueron ignorados (solo se aceptan imágenes).");
    } else if (images.length > available) {
      setGlobalError(`Solo se añadieron ${toProcess.length} de ${images.length} fotos (límite: ${maxImages}).`);
    }
    if (toProcess.length === 0) return;

    const startingIndex = activeCount;
    const uploaded = await Promise.all(toProcess.map((f, i) => uploadToR2(f, startingIndex + i)));
    const succeeded = uploaded.filter((r): r is NonNullable<typeof r> => r !== null);

    // Modo legacy (autoProcess): mismo comportamiento de siempre, analiza y finaliza en el acto.
    if (!autoProcess) return;

    const analyzed = await Promise.all(succeeded.map((r) => analyzePhoto(r)));
    const analyzedOk = analyzed.filter((r): r is NonNullable<typeof r> => r !== null);
    const interleaved = interleaveByCategory(analyzedOk);
    await Promise.all(interleaved.map((item, position) => finalizePhoto(item, startingIndex + position)));
  }

  // Modo wizard (!autoProcess): dispara el análisis + generación coordinada de TODO el lote
  // acumulado en "uploaded" de una sola vez (paso 3 del wizard de campañas).
  async function confirmAndGenerate(): Promise<void> {
    setConfirming(true);
    try {
      const pending = items.filter(
        (i): i is UploadItem & { r2Url: string; r2Key: string } => i.step === "uploaded" && !!i.r2Url && !!i.r2Key,
      );
      const analyzed = await Promise.all(
        pending.map((item) => analyzePhoto({ id: item.id, r2Url: item.r2Url, r2Key: item.r2Key, batchIndex: item.batchIndex })),
      );
      const analyzedOk = analyzed.filter((r): r is NonNullable<typeof r> => r !== null);
      const interleaved = interleaveByCategory(analyzedOk);
      await Promise.all(interleaved.map((item, position) => finalizePhoto(item, position)));
    } finally {
      setConfirming(false);
    }
  }

  async function approveItem(id: string): Promise<void> {
    const item = items.find((i) => i.id === id);
    if (!item || item.step !== "ready" || !item.r2Url) return;

    updateItem(id, { step: "saving" });

    try {
      const title = item.editBody.split("\n")[0]?.replace(/^#+\s*/, "").slice(0, 72).trim() ?? "Post";
      const bodyWithHashtags = item.editHashtags.length
        ? `${item.editBody}\n\n${item.editHashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
        : item.editBody;
      const scheduledAt = toIsoString(item.editDate, item.editTime);

      const res = await fetch("/api/socialflow/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
          campaignId,
          provider: item.editProvider,
          contentType: item.editContentType,
          title,
          body: bodyWithHashtags,
          imageHint: item.r2Url,
          status: "SCHEDULED",
          scheduledAt,
        }),
      });
      const data = (await res.json()) as { post?: { id: string }; code?: string; message?: string };
      if (!res.ok || !data.post) throw new Error(data.message ?? data.code ?? "Error al guardar el post.");

      updateItem(id, { step: "saved", savedAt: scheduledAt });
    } catch (e) {
      updateItem(id, { step: "ready", error: e instanceof Error ? e.message : "Error al guardar." });
    } finally {
      router.refresh();
    }
  }

  async function approveAll(): Promise<void> {
    const readyIds = items.filter((i) => i.step === "ready").map((i) => i.id);
    await Promise.all(readyIds.map((id) => approveItem(id)));
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.localPreviewUrl);
      return prev.filter((i) => i.id !== id);
    });
  }

  function editBody(id: string, value: string) {
    updateItem(id, { editBody: value });
  }

  return {
    items,
    globalError,
    confirming,
    activeCount,
    uploadedCount,
    readyCount,
    savedCount,
    addFiles,
    confirmAndGenerate,
    approveItem,
    approveAll,
    removeItem,
    editBody,
  };
}

// Grid de tarjetas (miniatura + estado + edición cuando "ready"), compartida entre el flujo legacy
// y el wizard. No incluye dropzone ni cabecera de contador — cada caller monta eso alrededor.
export function PhotoBatchGrid({
  items,
  onRemove,
  onApprove,
  onEditBody,
}: {
  items: UploadItem[];
  onRemove: (id: string) => void;
  onApprove: (id: string) => void;
  onEditBody: (id: string, value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.id} className="flex flex-col overflow-hidden rounded-xl border border-white/8 bg-white/3">
          <div className="relative h-32 overflow-hidden bg-black/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.localPreviewUrl} alt="" className="h-full w-full object-cover" />
            {(item.step === "uploading" || item.step === "analyzing" || item.step === "saving") && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-violet-400" />
              </div>
            )}
            {item.step === "uploaded" && (
              <div className="absolute bottom-1.5 right-1.5">
                <span className="rounded-full border border-violet-500/40 bg-violet-500/20 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                  ✓ Subida
                </span>
              </div>
            )}
            {item.step === "saved" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2 py-1 text-[11px] font-bold text-emerald-300">
                  ✓ Programado
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2 p-3">
            {item.step === "uploading" && <p className="text-xs text-white/40">Subiendo…</p>}
            {item.step === "uploaded" && <p className="text-xs text-white/40">Esperando confirmación…</p>}
            {item.step === "analyzing" && <p className="text-xs text-white/40">Analizando con IA…</p>}
            {item.step === "error" && (
              <>
                <p className="text-xs text-rose-300">{item.error}</p>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="self-start rounded-lg border border-rose-500/25 px-2 py-1 text-xs text-rose-400 transition hover:bg-rose-500/10"
                >
                  Eliminar
                </button>
              </>
            )}
            {item.step === "ready" && (
              <>
                <textarea
                  value={item.editBody}
                  onChange={(e) => onEditBody(item.id, e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
                <div className="flex flex-wrap gap-1">
                  {item.editHashtags.slice(0, 4).map((h) => (
                    <span key={h} className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">{h}</span>
                  ))}
                  {item.editHashtags.length > 4 && (
                    <span className="text-[10px] text-white/30">+{item.editHashtags.length - 4}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/40">
                  <span>{displayDate(item.editDate)} · {item.editTime} UTC</span>
                  <span>{PROVIDER_LABELS[item.editProvider] ?? item.editProvider}</span>
                  <span>{CONTENT_TYPE_LABELS[item.editContentType] ?? item.editContentType}</span>
                </div>
                <div className="mt-auto flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-white/35 transition hover:border-rose-500/30 hover:text-rose-400"
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    onClick={() => onApprove(item.id)}
                    className="flex-1 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 py-1.5 text-xs font-bold text-white shadow-sm transition hover:brightness-110"
                  >
                    Aprobar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
