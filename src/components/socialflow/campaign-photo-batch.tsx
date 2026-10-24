"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ImageAnalysis } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";
import { CAROUSEL_MIN_ITEMS } from "@/lib/socialflow/meta/publishing";
import { getImageDimensions, isHorizontalImage } from "@/lib/socialflow/media/image-dimensions";

// Shared upload/analyze/finalize/approve pipeline behind CampaignPhotoUpload (legacy "Subir fotos"
// button, autoProcess: true — analiza cada foto en cuanto se sube, sin cambios de comportamiento)
// and CreateCampaignWizard's step 2/3 (autoProcess: false — solo sube en el paso 2; el análisis +
// generación coordinada de todo el lote se dispara una vez desde confirmAndGenerate() en el paso 3).

export type ContentCategory = "foto_real" | "grafico_texto";
// "reel_ready": el usuario ya generó y vio el vídeo en ReelsCreator (reelVideoUrl
// presente) — puede aprobarse por el flujo normal. Un item "ready" con
// editContentType "REEL" pero sin reelVideoUrl nunca es aprobable (ver approveItem).
export type ItemStep = "uploading" | "uploaded" | "analyzing" | "ready" | "reel_ready" | "saving" | "saved" | "error";

// Slide ya resuelto por CarouselComposerAgent (ver suggestedCarouselPosts en
// photos/route.ts) — imageUrl es la URL R2 de una de las fotos miembro del grupo.
export type CarouselSlideDraft = { order: number; imageUrl: string; text: string; role: string };

export type UploadItem = {
  id: string;
  file: File;
  localPreviewUrl: string;
  r2Url: string | null;
  r2Key: string | null;
  reelVideoUrl?: string;     // set only after the user reviewed the video in ReelsCreator
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
  // Presentes SOLO si este item representa un grupo CAROUSEL (N fotos agrupadas en 1
  // post, ver finalizeCarouselGroup) — ausentes en items normales de 1 foto = 1 post.
  // El item de grupo reemplaza en `items` a las N fotos miembro que lo componen (mismo
  // patrón "1 entrada = 1 publicación" que ya usan las demás cuentas del hook).
  carouselSlideCount?: number;
  carouselSlides?: CarouselSlideDraft[];
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

// Réplica cliente EXACTA de pickContentTypeFromMix en photos/route.ts — misma fórmula,
// determinista sobre el mismo índice. Necesaria para saber ANTES de llamar a finalize
// qué fotos caerán en CAROUSEL (el servidor solo la aplica dentro de la generación
// singular de post, demasiado tarde para agrupar — ver auditoría previa). Si algún día
// diverge del servidor, el peor caso es agrupar/no agrupar de más — el servidor sigue
// siendo la autoridad final (isCarouselRequest revalida CAROUSEL_MIN_ITEMS él solo).
function pickContentTypeFromMix(
  index: number,
  counts: { FEED: number; REEL: number; STORY: number; CAROUSEL: number },
): "FEED" | "REEL" | "STORY" | "CAROUSEL" | null {
  const total = counts.FEED + counts.REEL + counts.STORY + counts.CAROUSEL;
  if (total <= 0) return null;
  const position = index % total;
  if (position < counts.FEED) return "FEED";
  if (position < counts.FEED + counts.REEL) return "REEL";
  if (position < counts.FEED + counts.REEL + counts.STORY) return "STORY";
  return "CAROUSEL";
}

// Forma común a analyzePhoto/finalizePhoto/finalizeCarouselGroup — una foto ya subida y
// analizada, lista para pasar a la fase de generación (individual o agrupada).
type AnalyzedPhoto = { id: string; r2Url: string; r2Key: string; imageAnalysis: ImageAnalysis; batchIndex: number };

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
  const [skippedReelsCount, setSkippedReelsCount] = useState(0);

  const activeCount = items.filter((i) => i.step !== "error").length;
  const uploadedCount = items.filter((i) => i.step === "uploaded").length;
  const readyCount = items.filter((i) => i.step === "ready").length;
  const savedCount = items.filter((i) => i.step === "saved").length;
  // Cuenta real de items aprobables en bloque: excluye Reels "ready" sin video revisado.
  const approvableCount = items.filter(
    (i) => (i.step === "ready" && i.editContentType !== "REEL") || i.step === "reel_ready"
  ).length;

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
      const { width, height } = await getImageDimensions(file);
      if (isHorizontalImage(width, height)) {
        throw new Error("Esta foto es horizontal. Instagram requiere fotos verticales o cuadradas.");
      }

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
    item: AnalyzedPhoto,
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

  // Cuenta real de la mezcla de la campaña (postCount/reelCount/historiaCount/
  // carouselCount) — necesaria para pickContentTypeFromMix. campaigns-board.tsx ya la
  // tiene en memoria (createdCampaign) pero no se la pasa al hook; en vez de forzar un
  // cambio ahí, el hook la pide ella misma por campaignId/saasId (ambos ya son
  // argumentos existentes de useCampaignPhotoBatch). Fallo silencioso a "sin mix" (todo
  // 0): si la campaña no aparece en la lista o la request falla, pickContentTypeFromMix
  // nunca devuelve CAROUSEL y el flujo cae exactamente al camino FEED/REEL/STORY de
  // siempre — cero regresión si esto falla.
  async function fetchCarouselMix(): Promise<{ FEED: number; REEL: number; STORY: number; CAROUSEL: number }> {
    const empty = { FEED: 0, REEL: 0, STORY: 0, CAROUSEL: 0 };
    try {
      const res = await fetch(`/api/socialflow/campaigns?saasId=${encodeURIComponent(saasId)}`);
      if (!res.ok) return empty;
      const data = (await res.json()) as {
        items?: Array<{ id: string; postCount?: number; reelCount?: number; historiaCount?: number; carouselCount?: number }>;
      };
      const campaign = data.items?.find((c) => c.id === campaignId);
      if (!campaign) return empty;
      return {
        FEED: campaign.postCount ?? 0,
        REEL: campaign.reelCount ?? 0,
        STORY: campaign.historiaCount ?? 0,
        CAROUSEL: campaign.carouselCount ?? 0,
      };
    } catch {
      return empty;
    }
  }

  // Una sola llamada agrupada para TODAS las fotos que el mix asignó a CAROUSEL en este
  // lote — el servidor internamente las trocea en lotes de maxSlides (chunkCarouselPhotos
  // en photos/route.ts) y puede devolver más de un post si el grupo es más grande que un
  // carrusel. Cada post recibido reemplaza a sus fotos miembro en `items` por UNA sola
  // tarjeta (ver carouselSlideCount/carouselSlides en UploadItem) — "un carrusel = 1
  // publicación", igual que el resto del hook trata cualquier otro item.
  async function finalizeCarouselGroup(members: AnalyzedPhoto[], scheduleIndex: number): Promise<void> {
    try {
      const res = await fetch(`/api/socialflow/campaigns/${campaignId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrls: members.map((m) => m.r2Url),
          imageKeys: members.map((m) => m.r2Key),
          imageAnalyses: members.map((m) => m.imageAnalysis),
          saasId,
          scheduleIndex,
        }),
      });
      const data = (await res.json()) as {
        suggestedCarouselPosts?: {
          title: string; body: string; hashtags: string[]; provider: string;
          scheduledAt: string; slides: CarouselSlideDraft[];
        }[];
        failedGroups?: { failedSlides: { imageKey: string; message: string }[] }[];
        skippedImages?: { imageKey: string }[];
        code?: string; message?: string;
      };
      // Fallo total (ej. CAROUSEL_BATCH_FAILED, 422, sin ningún post generado) — se trata
      // como error uniforme para todo el grupo, igual que cualquier otro catch de este
      // hook. Un fallo PARCIAL (algunos posts sí, otros no) NO entra aquí — res.ok sigue
      // siendo true mientras haya al menos un post en suggestedCarouselPosts.
      if (!res.ok && !data.suggestedCarouselPosts) {
        throw new Error(data.message ?? data.code ?? "Error al generar el carrusel.");
      }

      // Fotos reportadas explícitamente como problema (análisis fallido dentro de su
      // lote, o resto final por debajo de CAROUSEL_MIN_ITEMS) — mensaje específico en vez
      // del genérico de más abajo.
      const problemMessageByKey = new Map<string, string>();
      for (const group of data.failedGroups ?? []) {
        for (const slide of group.failedSlides) problemMessageByKey.set(slide.imageKey, slide.message);
      }
      for (const skipped of data.skippedImages ?? []) {
        if (!problemMessageByKey.has(skipped.imageKey)) {
          problemMessageByKey.set(skipped.imageKey, "Grupo de carrusel incompleto (muy pocas fotos para formar un lote).");
        }
      }

      // Cada post consume las fotos cuyo slide.imageUrl coincide con su r2Url — así se
      // reconstruye la pertenencia sin depender de conocer maxSlides en el cliente (el
      // servidor trocea con un límite que el cliente no tiene por qué conocer).
      const consumedIds = new Set<string>();
      const newGroupItems: UploadItem[] = [];
      for (const post of data.suggestedCarouselPosts ?? []) {
        const postMembers = post.slides
          .map((slide) => members.find((m) => m.r2Url === slide.imageUrl))
          .filter((m): m is AnalyzedPhoto => !!m);
        if (postMembers.length === 0) continue;
        postMembers.forEach((m) => consumedIds.add(m.id));

        const orderedSlides = [...post.slides].sort((a, b) => a.order - b.order);
        const cover = items.find((i) => i.id === postMembers[0].id);
        if (!cover) continue;

        newGroupItems.push({
          ...cover,
          id: crypto.randomUUID(),
          r2Url: orderedSlides[0]?.imageUrl ?? cover.r2Url,
          step: "ready",
          error: null,
          editBody: post.body,
          editHashtags: post.hashtags,
          editDate: parseDate(post.scheduledAt),
          editTime: parseTime(post.scheduledAt),
          editContentType: "CAROUSEL",
          editProvider: post.provider,
          carouselSlideCount: orderedSlides.length,
          carouselSlides: orderedSlides,
        });
      }

      // Cualquier miembro que no quedó dentro de ningún post generado (fallo reportado, o
      // caso límite no cubierto explícitamente) se marca como error — nunca desaparece en
      // silencio de la UI, mismo criterio que el resto del hook.
      for (const m of members) {
        if (consumedIds.has(m.id)) continue;
        updateItem(m.id, {
          step: "error",
          error: problemMessageByKey.get(m.r2Key) ?? "No se pudo incluir esta foto en ningún carrusel.",
        });
      }

      setItems((prev) => [...prev.filter((i) => !consumedIds.has(i.id)), ...newGroupItems]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error inesperado al generar el carrusel.";
      members.forEach((m) => updateItem(m.id, { step: "error", error: message }));
    }
  }

  // Punto único de finalización para un lote ya analizado e intercalado — usado tanto por
  // confirmAndGenerate (wizard) como por addFiles (legacy). Precalcula qué posiciones caen
  // en CAROUSEL según el mix real de la campaña (pickContentTypeFromMix) ANTES de llamar a
  // ninguna API, así puede agruparlas en una sola llamada en vez de mandarlas una a una
  // (que el servidor rechazaría como carrusel de 1 sola foto — ver auditoría previa).
  // baseIndex es el mismo offset que ya usaban ambos callers para que scheduleIndex por
  // foto siga siendo consistente con el resto de la campaña.
  async function finalizeInterleavedBatch(interleaved: AnalyzedPhoto[], baseIndex: number): Promise<void> {
    const mix = await fetchCarouselMix();
    const withPosition = interleaved.map((item, position) => ({ item, scheduleIndex: baseIndex + position }));

    const carouselCandidates = withPosition.filter((e) => pickContentTypeFromMix(e.scheduleIndex, mix) === "CAROUSEL");
    // Por debajo de CAROUSEL_MIN_ITEMS no hay carrusel posible (mismo mínimo que valida
    // photos/route.ts) — esas fotos vuelven al camino individual, donde el servidor ya
    // sabe caer de vuelta al formato sugerido por LLaVA para una sola foto.
    const useGroup = carouselCandidates.length >= CAROUSEL_MIN_ITEMS;
    const carouselEntries = useGroup ? carouselCandidates : [];
    const individualEntries = useGroup
      ? withPosition.filter((e) => pickContentTypeFromMix(e.scheduleIndex, mix) !== "CAROUSEL")
      : withPosition;

    const tasks: Promise<void>[] = individualEntries.map((e) => finalizePhoto(e.item, e.scheduleIndex));
    if (carouselEntries.length > 0) {
      tasks.push(finalizeCarouselGroup(carouselEntries.map((e) => e.item), carouselEntries[0].scheduleIndex));
    }
    await Promise.all(tasks);
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
    await finalizeInterleavedBatch(interleaved, startingIndex);
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
      await finalizeInterleavedBatch(interleaved, 0);
    } finally {
      setConfirming(false);
    }
  }

  async function approveItem(id: string): Promise<void> {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    // Un Reel solo es aprobable una vez revisado en ReelsCreator (reelVideoUrl presente,
    // step "reel_ready"). Un item "ready" clasificado REEL por la IA pero nunca visto
    // como vídeo se ignora en silencio — la UI ya le oculta el botón "Aprobar" para este caso.
    const isReel = item.editContentType === "REEL";
    // Un grupo CAROUSEL aprueba TODAS sus fotos de golpe (1 carrusel = 1 publicación) —
    // mismo botón "Aprobar"/"Aprobar todo" que cualquier otro item, sin lógica extra en
    // approveAll. imageHint usa el primer slide por `order` (mismo criterio que
    // publish-carrusel.tsx), no r2Url del item (que aquí solo guarda una referencia de
    // portada, ver finalizeCarouselGroup).
    const orderedSlides = item.carouselSlides ? [...item.carouselSlides].sort((a, b) => a.order - b.order) : null;
    const mediaUrl = isReel ? item.reelVideoUrl : orderedSlides ? orderedSlides[0]?.imageUrl ?? item.r2Url : item.r2Url;
    const approvable = isReel ? item.step === "reel_ready" && !!item.reelVideoUrl : item.step === "ready" && !!mediaUrl;
    if (!approvable || !mediaUrl) return;

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
          imageHint: mediaUrl,
          status: "SCHEDULED",
          scheduledAt,
          ...(orderedSlides ? { metadata: { slides: orderedSlides } } : {}),
        }),
      });
      const data = (await res.json()) as { post?: { id: string }; code?: string; message?: string };
      if (!res.ok || !data.post) throw new Error(data.message ?? data.code ?? "Error al guardar el post.");

      updateItem(id, { step: "saved", savedAt: scheduledAt });
    } catch (e) {
      updateItem(id, { step: isReel ? "reel_ready" : "ready", error: e instanceof Error ? e.message : "Error al guardar." });
    } finally {
      router.refresh();
    }
  }

  async function approveAll(): Promise<void> {
    const approvableIds = items
      .filter((i) => (i.step === "ready" && i.editContentType !== "REEL") || i.step === "reel_ready")
      .map((i) => i.id);
    const skippedReels = items.filter(
      (i) => i.step === "ready" && i.editContentType === "REEL" && !i.reelVideoUrl
    ).length;
    await Promise.all(approvableIds.map((id) => approveItem(id)));
    setSkippedReelsCount(skippedReels);
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

  function editContentType(id: string, value: string) {
    updateItem(id, { editContentType: value });
  }

  // Llamado desde el modal ReelsCreator (onApproved) tras generar y revisar el vídeo —
  // entrega el resultado al item para que se programe por el mismo approveItem/"Aprobar"
  // que el resto del batch, en vez de que ReelsCreator guarde el post por su cuenta.
  function markReelReady(
    id: string,
    videoUrl: string,
    suggestedPost?: { body: string; hashtags: string[]; scheduledAt: string } | null,
  ) {
    updateItem(id, {
      reelVideoUrl: videoUrl,
      editContentType: "REEL",
      step: "reel_ready",
      ...(suggestedPost
        ? {
            editBody: suggestedPost.body,
            editHashtags: suggestedPost.hashtags,
            editDate: parseDate(suggestedPost.scheduledAt),
            editTime: parseTime(suggestedPost.scheduledAt),
          }
        : {}),
    });
  }

  function clearSkippedReels() {
    setSkippedReelsCount(0);
  }

  return {
    items,
    globalError,
    confirming,
    activeCount,
    uploadedCount,
    readyCount,
    approvableCount,
    skippedReelsCount,
    savedCount,
    addFiles,
    confirmAndGenerate,
    approveItem,
    approveAll,
    removeItem,
    editBody,
    editContentType,
    markReelReady,
    clearSkippedReels,
  };
}

// Grid de tarjetas (miniatura + estado + edición cuando "ready"), compartida entre el flujo legacy
// y el wizard. No incluye dropzone ni cabecera de contador — cada caller monta eso alrededor.
export function PhotoBatchGrid({
  items,
  onRemove,
  onApprove,
  onEditBody,
  onEditContentType,
  onCreateReel,
}: {
  items: UploadItem[];
  onRemove: (id: string) => void;
  onApprove: (id: string) => void;
  onEditBody: (id: string, value: string) => void;
  onEditContentType: (id: string, value: string) => void;
  // Opcional — solo el wizard de creación de campaña lo pasa. El flujo legacy
  // (botón "Subir fotos" en una campaña ya creada) no lo usa y no cambia de
  // comportamiento.
  onCreateReel?: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.id} className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="relative h-32 overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.localPreviewUrl} alt="" className="h-full w-full object-cover" />
            {(item.step === "uploading" || item.step === "analyzing" || item.step === "saving") && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-blue-400" />
              </div>
            )}
            {item.step === "uploaded" && (
              <div className="absolute bottom-1.5 right-1.5">
                <span className="rounded-full border border-blue-400 bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  ✓ Subida
                </span>
              </div>
            )}
            {item.step === "saved" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="rounded-full border border-emerald-400 bg-emerald-500 px-2 py-1 text-[11px] font-bold text-white">
                  ✓ Programado
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2 p-3">
            {item.step === "uploading" && <p className="text-xs text-gray-400">Subiendo…</p>}
            {item.step === "uploaded" && <p className="text-xs text-gray-400">Esperando confirmación…</p>}
            {item.step === "analyzing" && <p className="text-xs text-gray-400">Analizando…</p>}
            {item.step === "error" && (
              <>
                <p className="text-xs text-red-600">{item.error}</p>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="self-start rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 transition hover:bg-red-50"
                >
                  Eliminar
                </button>
              </>
            )}
            {item.step === "ready" && item.carouselSlideCount ? (
              // Grupo CAROUSEL: N fotos agrupadas en 1 tarjeta = 1 publicación. Se
              // aprueba/elimina de golpe, sin el selector FEED/Historia/Reel (no aplica a
              // un grupo ya compuesto) ni el flujo de Reel — solo cuerpo, hashtags,
              // fecha/proveedor y Aprobar, igual que el resto de items en su forma final.
              <>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                    📑 Carrusel ({item.carouselSlideCount} fotos)
                  </span>
                </div>
                <textarea
                  value={item.editBody}
                  onChange={(e) => onEditBody(item.id, e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
                <div className="flex flex-wrap gap-1">
                  {item.editHashtags.slice(0, 4).map((h) => (
                    <span key={h} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">{h}</span>
                  ))}
                  {item.editHashtags.length > 4 && (
                    <span className="text-[10px] text-gray-400">+{item.editHashtags.length - 4}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                  <span>{displayDate(item.editDate)} · {item.editTime}</span>
                  <span>{PROVIDER_LABELS[item.editProvider] ?? item.editProvider}</span>
                </div>
                <div className="mt-auto flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-400 transition hover:border-red-300 hover:text-red-600"
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    onClick={() => onApprove(item.id)}
                    className="flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 py-1.5 text-xs font-bold text-white shadow-sm transition hover:from-blue-600 hover:to-cyan-600"
                  >
                    Aprobar carrusel
                  </button>
                </div>
              </>
            ) : item.step === "ready" ? (
              <>
                <textarea
                  value={item.editBody}
                  onChange={(e) => onEditBody(item.id, e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
                <div className="flex flex-wrap gap-1">
                  {item.editHashtags.slice(0, 4).map((h) => (
                    <span key={h} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-700">{h}</span>
                  ))}
                  {item.editHashtags.length > 4 && (
                    <span className="text-[10px] text-gray-400">+{item.editHashtags.length - 4}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                  <span>{displayDate(item.editDate)} · {item.editTime}</span>
                  <span>{PROVIDER_LABELS[item.editProvider] ?? item.editProvider}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onEditContentType(item.id, "FEED")}
                    className={`flex-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                      item.editContentType === "FEED"
                        ? "border-blue-400 bg-blue-100 text-blue-700"
                        : "border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                    }`}
                  >
                    📸 Post
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditContentType(item.id, "STORY")}
                    className={`flex-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                      item.editContentType === "STORY"
                        ? "border-blue-400 bg-blue-100 text-blue-700"
                        : "border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                    }`}
                  >
                    ⭕ Historia
                  </button>
                  {onCreateReel && (
                    <button
                      type="button"
                      onClick={() => onCreateReel(item.id)}
                      className={`flex-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
                        item.editContentType === "REEL"
                          ? "border-blue-400 bg-blue-100 text-blue-700"
                          : "border-gray-200 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                      }`}
                    >
                      🎬 Reel
                    </button>
                  )}
                </div>
                <div className="mt-auto flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onRemove(item.id)}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-400 transition hover:border-red-300 hover:text-red-600"
                  >
                    ✕
                  </button>
                  {item.editContentType === "REEL" && !item.reelVideoUrl ? (
                    onCreateReel ? (
                      <button
                        type="button"
                        onClick={() => onCreateReel(item.id)}
                        className="flex-1 rounded-lg border border-blue-300 bg-blue-50 py-1.5 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                      >
                        ▶ Ver Reel
                      </button>
                    ) : (
                      <span className="flex-1 rounded-lg border border-gray-200 py-1.5 text-center text-[11px] text-gray-400">
                        Revisión de Reel requerida
                      </span>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => onApprove(item.id)}
                      className="flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 py-1.5 text-xs font-bold text-white shadow-sm transition hover:from-blue-600 hover:to-cyan-600"
                    >
                      Aprobar
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
