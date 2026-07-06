"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ImageAnalysis } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";

// Campaign-scoped sibling of UploadToPost (src/components/socialflow/upload-to-post.tsx) —
// intentionally a separate component: it talks to /api/socialflow/campaigns/[id]/photos
// (campaign-aware narrative + bounded scheduling) instead of the individual-photo endpoint,
// and always sends campaignId when persisting the post.

type ContentCategory = "foto_real" | "grafico_texto";
type ItemStep = "uploading" | "analyzing" | "ready" | "saving" | "saved" | "error";

type UploadItem = {
  id: string;
  file: File;
  localPreviewUrl: string;
  r2Url: string | null;
  r2Key: string | null;
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

const CONTENT_TYPE_LABELS: Record<string, string> = { FEED: "Feed", REEL: "Reel", STORY: "Story" };
const PROVIDER_LABELS: Record<string, string> = { INSTAGRAM: "Instagram", LINKEDIN: "LinkedIn" };

function parseDate(iso: string): string {
  return iso.slice(0, 10);
}
function parseTime(iso: string): string {
  return iso.slice(11, 16);
}
function toIsoString(date: string, time: string): string {
  return `${date}T${time || "09:00"}:00.000Z`;
}
function displayDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// Same content-type interleaving as UploadToPost so a campaign's calendar alternates
// real photos and graphic/text cards regardless of upload order.
function interleaveByCategory<T extends { contentCategory: ContentCategory }>(list: T[]): T[] {
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

export default function CampaignPhotoUpload({
  campaignId,
  saasId,
  maxImages = 8,
}: {
  campaignId: string;
  saasId: string;
  maxImages?: number;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const savedCount = items.filter((i) => i.step === "saved").length;
  const readyCount = items.filter((i) => i.step === "ready").length;
  const activeCount = items.filter((i) => i.step !== "error").length;

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  async function analyzeFile(
    file: File,
    batchIndex: number,
  ): Promise<
    | { id: string; r2Url: string; r2Key: string; imageAnalysis: ImageAnalysis; contentCategory: ContentCategory; batchIndex: number }
    | null
  > {
    const id = crypto.randomUUID();
    const localPreviewUrl = URL.createObjectURL(file);

    setItems((prev) => [
      ...prev,
      {
        id, file, localPreviewUrl,
        r2Url: null, r2Key: null,
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

      updateItem(id, { r2Url: uploadData.url, r2Key: uploadData.key, step: "analyzing" });

      const analyzeRes = await fetch(`/api/socialflow/campaigns/${campaignId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: uploadData.url, imageKey: uploadData.key, saasId, mode: "analyze" }),
      });
      const analyzeData = (await analyzeRes.json()) as {
        imageAnalysis?: ImageAnalysis;
        contentCategory?: ContentCategory;
        code?: string; message?: string;
      };
      if (!analyzeRes.ok || !analyzeData.imageAnalysis || !analyzeData.contentCategory) {
        throw new Error(analyzeData.message ?? analyzeData.code ?? "Error al analizar la imagen.");
      }

      updateItem(id, { imageAnalysis: analyzeData.imageAnalysis, contentCategory: analyzeData.contentCategory });

      return {
        id,
        r2Url: uploadData.url,
        r2Key: uploadData.key,
        imageAnalysis: analyzeData.imageAnalysis,
        contentCategory: analyzeData.contentCategory,
        batchIndex,
      };
    } catch (e) {
      updateItem(id, { step: "error", error: e instanceof Error ? e.message : "Error inesperado." });
      return null;
    }
  }

  async function finalizeFile(
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

  async function handleFiles(newFiles: FileList | File[]) {
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
    const analyzed = await Promise.all(toProcess.map((f, i) => analyzeFile(f, startingIndex + i)));
    const succeeded = analyzed.filter((r): r is NonNullable<typeof r> => r !== null);
    const interleaved = interleaveByCategory(succeeded);
    await Promise.all(interleaved.map((item, position) => finalizeFile(item, startingIndex + position)));
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

  return (
    <div className="space-y-4 p-4">
      {globalError && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">{globalError}</div>
      )}

      <div
        onClick={() => fileInputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/12 bg-white/3 p-8 text-center transition hover:border-violet-500/40 hover:bg-violet-500/5"
      >
        <p className="text-sm font-semibold text-white/70">Arrastra o haz click para subir fotos de esta campaña</p>
        <p className="text-xs text-white/30">Hasta {maxImages} fotos · JPEG, PNG, WebP, GIF</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); }}
        />
      </div>

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-white/40">
              {activeCount} foto{activeCount !== 1 ? "s" : ""}
              {savedCount > 0 && (
                <span className="ml-2 text-emerald-400">· {savedCount} programada{savedCount !== 1 ? "s" : ""}</span>
              )}
            </p>
            {readyCount >= 1 && (
              <button
                type="button"
                onClick={() => void approveAll()}
                className="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
              >
                Aprobar todo ({readyCount})
              </button>
            )}
          </div>

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
                  {item.step === "analyzing" && <p className="text-xs text-white/40">Analizando con IA…</p>}
                  {item.step === "error" && (
                    <>
                      <p className="text-xs text-rose-300">{item.error}</p>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
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
                        onChange={(e) => updateItem(item.id, { editBody: e.target.value })}
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
                          onClick={() => removeItem(item.id)}
                          className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-white/35 transition hover:border-rose-500/30 hover:text-rose-400"
                        >
                          ✕
                        </button>
                        <button
                          type="button"
                          onClick={() => void approveItem(item.id)}
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
        </>
      )}
    </div>
  );
}
