"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ImageAnalysis } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";
import type { CarouselSlideRole } from "@/lib/socialflow/ai/agents/CarouselComposerAgent";
import { StaticSlideRenderer } from "@/lib/socialflow/carousel/StaticSlideRenderer";
import { getStyleForCarousel, getNichoPackKey, CAROUSEL_STYLE_PACKS, type CarouselStyleVariant } from "@/lib/socialflow/carousel/CarouselStylePacks";
import { getImageDimensions, isHorizontalImage } from "@/lib/socialflow/media/image-dimensions";

// Mismo límite real de la Graph API que ya aplica el backend (CAROUSEL_MIN_ITEMS en
// meta/publishing.ts) — duplicado aquí como número simple para no meter ese módulo
// server-only (decryptToken, llamadas a graph.facebook.com) en el bundle de cliente.
const CAROUSEL_MIN_SLIDES = 2;

// Mismo criterio: CAROUSEL_CAPTION_MAX_LENGTH vive en CarouselComposerAgent.ts (server-only,
// importa @/lib/cf y defaultLocalModel) — duplicado aquí como número simple, no como
// import de valor, para no arrastrar ese módulo al bundle de cliente.
const CAROUSEL_CAPTION_MAX_LENGTH = 2200;

type Phase = "idle" | "uploading" | "composing" | "rendering" | "review" | "saved" | "error";

type CarouselPhotoSlot = {
  id: string;
  file: File;
  previewUrl: string;
};

// "pending": recién generado o recién editado — sin aprobar todavía.
// "approved": listo para guardar.
// "editing": textarea abierto, draftText puede diferir de text.
// "applying": re-renderizando + subiendo el nuevo compuesto a R2.
// "rejected_awaiting_replacement": el conteo NUNCA baja — la posición queda marcada
// pendiente de una foto nueva, no se puede guardar mientras exista este estado.
// "replacing": subiendo/analizando/recomponiendo la foto de reemplazo.
// "regenerating": pidiendo texto nuevo a la IA para ESTE slide (solo source "ai") y
// re-renderizando — separado de "applying" porque se dispara desde la vista normal de
// la tarjeta, no desde el modo edición.
type SlideReviewStatus =
  | "pending"
  | "approved"
  | "editing"
  | "applying"
  | "rejected_awaiting_replacement"
  | "replacing"
  | "regenerating";

type CarouselSlideState = {
  order: number;
  role: CarouselSlideRole;
  // null en slides "ai" (carrusel mixto) — no hay foto original que reanalizar/reemplazar.
  originalImageUrl: string | null;
  originalImageKey: string | null; // necesario para reanalizar SOLO este slot al reemplazar
  renderedImageUrl: string | null;
  text: string;        // texto YA aplicado — el que está quemado en renderedImageUrl
  draftText: string;   // valor del textarea mientras se edita, separado de `text`
  status: SlideReviewStatus;
  error: string | null; // error de re-render de ESTE slide, no del carrusel completo
  // "client": slide con foto subida por el cliente. "ai": slot que la IA rellenó con
  // texto puro (carrusel mixto, cuando el cliente sube menos fotos de las que su plan
  // permite) — sin foto original, StaticSlideRenderer usa `style` como fondo.
  source: "client" | "ai";
};

type FailedSlide = { order: number; imageKey?: string; message: string };

const ROLE_LABEL: Record<CarouselSlideRole, string> = {
  intro: "Intro",
  desarrollo: "Desarrollo",
  cierre_cta: "Cierre / CTA",
};

// Selector de tema previo a "Generar carrusel" — value viaja en el state del componente,
// sendValue es lo que llega al body de generate-from-image como `carouselTheme` ("auto"
// es el centinela que CarouselComposerAgent interpreta como "sin tema explícito", ver
// resolveSlidePlan/run en ese agente).
type CarouselTheme = "entrenamiento" | "nutricion" | "motivacion" | "educativo" | "lifestyle" | "auto";

const THEME_OPTIONS: { value: CarouselTheme; label: string; sendValue: string }[] = [
  { value: "entrenamiento", label: "🏋️ Entrenamiento", sendValue: "Entrenamiento" },
  { value: "nutricion", label: "🥗 Nutrición y recetas", sendValue: "Nutrición y recetas" },
  { value: "motivacion", label: "💪 Motivación", sendValue: "Motivación" },
  { value: "educativo", label: "📚 Educativo / Tips", sendValue: "Educativo / Tips" },
  { value: "lifestyle", label: "✨ Lifestyle", sendValue: "Lifestyle" },
  { value: "auto", label: "🎯 Lo que decida la IA", sendValue: "auto" },
];

function IcoUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
function IcoCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3.5 w-3.5">
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

async function uploadFile(file: File | Blob, filename = "upload"): Promise<{ url: string; key: string }> {
  const form = new FormData();
  form.append("file", file, file instanceof File ? file.name : filename);
  const res = await fetch("/api/socialflow/media/upload", { method: "POST", body: form });
  const data = (await res.json()) as { url?: string; key?: string; message?: string; error?: string };
  if (!res.ok || !data.url || !data.key) {
    throw new Error(data.message ?? data.error ?? "Error al subir el archivo.");
  }
  return { url: data.url, key: data.key };
}

// Shape de ViralScoreAgent.ts (ViralScore) duplicado aquí como tipo local, acotado
// solo a los campos que la UI del carrusel usa (score/label/explanation/improvements,
// sin `factors`) — igual que SuggestedCarouselPost ya se define localmente en vez de
// importar los tipos de la ruta API.
type ViralScoreState = {
  score: number;
  label: "Bajo" | "Medio" | "Alto" | "Viral";
  explanation: string;
  improvements: string[];
};

const VIRAL_SCORE_STYLES: Record<ViralScoreState["label"], string> = {
  Bajo: "border-rose-500/25 bg-rose-500/8 text-rose-300",
  Medio: "border-amber-500/25 bg-amber-500/8 text-amber-300",
  Alto: "border-emerald-500/25 bg-emerald-500/8 text-emerald-300",
  Viral: "border-purple-500/25 bg-purple-500/8 text-purple-300",
};

type SuggestedCarouselPost = {
  title: string;
  hashtags: string[];
  // Descripción de Instagram generada por CarouselComposerAgent, independiente del
  // texto visual de los slides — ver CAMBIO 2 (antes se concatenaban los slides).
  caption: string;
  provider: string;
  contentType: "CAROUSEL";
  scheduledAt: string;
  saasId: string;
  // imageUrl ausente en los slots que la IA rellenó (carrusel mixto) — ver targetSlideCount.
  slides: { order: number; imageUrl?: string; text: string; role: CarouselSlideRole }[];
  // null cuando calculateViralScore degradó internamente o cuando falla el punto de
  // integración en el backend (ver CAMBIO 3) — nunca bloquea la generación.
  viralScore: ViralScoreState | null;
};

// ── Tarjeta de revisión de un slide (mirror de ReelItemCard en publish-reel.tsx) ──

function CarouselSlideCard({
  slide,
  onApprove,
  onStartEdit,
  onCancelEdit,
  onDraftChange,
  onApplyEdit,
  onReject,
  onReplacePhoto,
  onUndoReject,
  onRegenerate,
}: {
  slide: CarouselSlideState;
  onApprove: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onDraftChange: (value: string) => void;
  onApplyEdit: () => void;
  onReject: () => void;
  onReplacePhoto: (file: File) => void;
  onUndoReject: () => void;
  onRegenerate: () => void;
}) {
  const needsReplacement = slide.status === "rejected_awaiting_replacement" || slide.status === "replacing";
  const isEditing = slide.status === "editing" || slide.status === "applying";
  const isApplying = slide.status === "applying";
  const isRegenerating = slide.status === "regenerating";

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/3">
      <div className="relative">
        {slide.renderedImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slide.renderedImageUrl}
            alt=""
            className={`aspect-[4/5] w-full object-cover ${needsReplacement ? "opacity-30" : ""}`}
          />
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
          {slide.source === "client" ? "📷 Tuya" : "✦ IA"}
        </span>
        {isRegenerating && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50">
            <Spinner />
            <p className="text-xs font-semibold text-white">Regenerando texto…</p>
          </div>
        )}
        {slide.status === "approved" && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-black text-white">
            <IcoCheck /> Aprobado
          </span>
        )}
        {needsReplacement && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 p-3 text-center">
            {slide.status === "replacing" ? (
              <>
                <Spinner />
                <p className="text-xs font-semibold text-white">Analizando foto nueva…</p>
              </>
            ) : (
              <>
                <span className="text-2xl">🔄</span>
                <p className="text-xs font-semibold text-white">Sube una foto de reemplazo para este slide</p>
                <label className="cursor-pointer rounded-lg bg-violet-500 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-violet-400">
                  Elegir foto
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) onReplacePhoto(f); e.target.value = ""; }}
                  />
                </label>
                <button
                  type="button"
                  onClick={onUndoReject}
                  className="text-[11px] text-white/50 underline transition hover:text-white/80"
                >
                  Deshacer rechazo
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2 px-3 py-3">
        <span className="text-[10px] font-black uppercase tracking-wide text-violet-400">
          {ROLE_LABEL[slide.role]}
        </span>

        {needsReplacement && slide.error && (
          <p className="text-[11px] text-rose-400">{slide.error}</p>
        )}

        {needsReplacement ? null : isEditing ? (
          <>
            <textarea
              value={slide.draftText}
              onChange={(e) => onDraftChange(e.target.value)}
              disabled={isApplying}
              rows={4}
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/50 disabled:opacity-50"
            />
            {slide.error && <p className="text-[11px] text-rose-400">{slide.error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isApplying || !slide.draftText.trim()}
                onClick={onApplyEdit}
                className="flex-1 rounded-lg bg-violet-500 py-1.5 text-[11px] font-bold text-white transition hover:bg-violet-400 disabled:opacity-50"
              >
                {isApplying ? "Aplicando…" : "Aplicar cambios"}
              </button>
              <button
                type="button"
                disabled={isApplying}
                onClick={onCancelEdit}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-white/50 transition hover:text-white/80 disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs leading-snug text-white/70">{slide.text}</p>
            <div className="flex gap-2">
              {slide.status !== "approved" && (
                <button
                  type="button"
                  disabled={isRegenerating}
                  onClick={onApprove}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-emerald-500 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  <IcoCheck /> Aprobar
                </button>
              )}
              <button
                type="button"
                disabled={isRegenerating}
                onClick={onStartEdit}
                className={[
                  "flex items-center justify-center gap-1 rounded-lg border border-white/10 py-1.5 text-[11px] text-white/60 transition hover:text-white/90 disabled:opacity-50",
                  slide.status === "approved" ? "flex-1" : "px-3",
                ].join(" ")}
              >
                <IcoPencil /> Editar
              </button>
              {slide.source === "ai" && (
                <button
                  type="button"
                  disabled={isRegenerating}
                  onClick={onRegenerate}
                  className="flex items-center justify-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-white/60 transition hover:text-white/90 disabled:opacity-50"
                >
                  ↺ Regenerar
                </button>
              )}
            </div>
            {slide.source === "client" && (
              <button
                type="button"
                onClick={onReject}
                className="w-full rounded-lg border border-rose-500/25 bg-rose-500/10 py-1.5 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-500/20"
              >
                Rechazar
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PublishCarrusel({ saasId, maxSlides = 6 }: { saasId: string; maxSlides?: number }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [photos, setPhotos] = useState<CarouselPhotoSlot[]>([]);
  const [carouselTheme, setCarouselTheme] = useState<CarouselTheme>("auto");
  const [slides, setSlides] = useState<CarouselSlideState[]>([]);
  const [slideAnalyses, setSlideAnalyses] = useState<ImageAnalysis[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [viralScore, setViralScore] = useState<ViralScoreState | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  // Resueltos UNA VEZ por carrusel en generateCarousel() y reutilizados tal cual en
  // cada render posterior (edición, reemplazo de foto) — nunca se recalculan a mitad
  // de revisión, para que todos los slides del mismo carrusel compartan estilo/handle
  // aunque el servidor devuelva un carouselIndex distinto en una llamada posterior.
  const [style, setStyle] = useState<CarouselStyleVariant | null>(null);
  const [styleLabel, setStyleLabel] = useState<string | null>(null);
  const [channelHandle, setChannelHandle] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [failedSlides, setFailedSlides] = useState<FailedSlide[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canGenerate = photos.length >= CAROUSEL_MIN_SLIDES && photos.length <= maxSlides;
  // Cuántos slides le faltan al carrusel para llegar al máximo de su plan — la IA los
  // rellena con texto puro (carrusel mixto). 0 si el cliente ya subió maxSlides fotos.
  const aiSlides = Math.max(0, maxSlides - photos.length);

  function photoCounterLabel(): string {
    const base = `${photos.length} de ${maxSlides} fotos`;
    if (photos.length >= maxSlides) return `${base} · Carrusel completo`;
    if (photos.length < CAROUSEL_MIN_SLIDES) return `${base} · mínimo ${CAROUSEL_MIN_SLIDES}`;
    return `${base} · La IA añadirá ${aiSlides} slide${aiSlides !== 1 ? "s" : ""} de texto`;
  }

  async function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    const available = maxSlides - photos.length;
    if (available <= 0) {
      setError(`Límite de ${maxSlides} fotos alcanzado para tu plan.`);
      return;
    }
    const incoming = Array.from(files).slice(0, available);
    const truncated = files.length > incoming.length;

    const dimensions = await Promise.all(incoming.map((f) => getImageDimensions(f).catch(() => null)));
    const accepted = incoming.filter((_, i) => !(dimensions[i] && isHorizontalImage(dimensions[i]!.width, dimensions[i]!.height)));
    const horizontalCount = incoming.length - accepted.length;

    if (horizontalCount > 0) {
      setError("Esta foto es horizontal. Instagram requiere fotos verticales o cuadradas.");
    } else if (truncated) {
      setError(`Solo se añadieron ${accepted.length} de ${files.length} fotos (límite de tu plan: ${maxSlides}).`);
    } else {
      setError(null);
    }
    const newSlots: CarouselPhotoSlot[] = accepted.map((file) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...newSlots]);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  async function generateCarousel() {
    setPhase("uploading");
    setError(null);
    setFailedSlides([]);
    try {
      const uploaded = await Promise.all(photos.map((p) => uploadFile(p.file)));

      setPhase("composing");
      const res = await fetch("/api/socialflow/posts/generate-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
          forcedContentType: "CAROUSEL",
          imageUrls: uploaded.map((u) => u.url),
          imageKeys: uploaded.map((u) => u.key),
          // Siempre se manda — el backend solo rellena con IA si es mayor que la
          // cantidad de fotos subidas; si no, es un no-op (comportamiento de siempre).
          targetSlideCount: maxSlides,
          carouselTheme: THEME_OPTIONS.find((o) => o.value === carouselTheme)?.sendValue ?? "auto",
        }),
      });
      const data = (await res.json()) as {
        suggestedCarouselPost?: SuggestedCarouselPost;
        imageAnalyses?: ImageAnalysis[];
        code?: string;
        message?: string;
        failedSlides?: FailedSlide[];
        niche?: string;
        channelHandle?: string;
        carouselIndex?: number;
      };

      if (!res.ok || !data.suggestedCarouselPost) {
        if (data.code === "CAROUSEL_SLIDE_ANALYSIS_FAILED" && data.failedSlides) {
          setFailedSlides(data.failedSlides);
          setError("Una o más fotos no se pudieron analizar. Revisa el detalle abajo.");
        } else {
          setError(data.message ?? "No se pudo generar el carrusel.");
        }
        setPhase("error");
        return;
      }

      const post = data.suggestedCarouselPost;
      setHashtags(post.hashtags);
      setCaption(post.caption);
      setViralScore(post.viralScore);
      setScheduledAt(post.scheduledAt);
      setSlideAnalyses(data.imageAnalyses ?? []);

      const resolvedStyle = getStyleForCarousel(data.niche ?? "", data.carouselIndex ?? 0);
      const packKey = getNichoPackKey(data.niche ?? "");
      setStyle(resolvedStyle);
      setStyleLabel(`${CAROUSEL_STYLE_PACKS[packKey].label} · ${resolvedStyle.label}`);
      setChannelHandle(data.channelHandle ?? null);
      setCarouselIndex(data.carouselIndex ?? 0);

      setPhase("rendering");
      const renderer = new StaticSlideRenderer();
      const rendered = await Promise.all(
        post.slides.map(async (slide) => {
          const blob = await renderer.render({
            imageUrl: slide.imageUrl,
            text: slide.text,
            role: slide.role,
            slideIndex: slide.order,
            style: resolvedStyle,
            handle: data.channelHandle ?? undefined,
          });
          const { url } = await uploadFile(blob, `slide_${slide.order}.jpg`);
          // Slots IA (carrusel mixto) no tienen entrada en `uploaded` — solo las
          // primeras photos.length posiciones corresponden a una foto subida.
          const uploadedPhoto = slide.imageUrl ? uploaded[slide.order] : undefined;
          return {
            order: slide.order,
            role: slide.role,
            originalImageUrl: slide.imageUrl ?? null,
            originalImageKey: uploadedPhoto?.key ?? null,
            renderedImageUrl: url,
            text: slide.text,
            draftText: slide.text,
            status: "pending",
            source: slide.imageUrl ? "client" : "ai",
            error: null,
          } satisfies CarouselSlideState;
        }),
      );

      setSlides(rendered.sort((a, b) => a.order - b.order));
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el carrusel.");
      setPhase("error");
    }
  }

  function patchSlide(order: number, patch: Partial<CarouselSlideState>) {
    setSlides((prev) => prev.map((s) => (s.order === order ? { ...s, ...patch } : s)));
  }

  function approveSlide(order: number) {
    patchSlide(order, { status: "approved" });
  }

  // Entrar en edición SIEMPRE desaprueba — el texto vigente deja de ser el aprobado
  // hasta que se aplique el cambio y se vuelva a aprobar explícitamente.
  function startEditSlide(order: number) {
    patchSlide(order, { status: "editing", error: null });
  }

  function updateDraftText(order: number, value: string) {
    patchSlide(order, { draftText: value });
  }

  // Cancelar descarta el draft y vuelve al texto/estado ya aplicado — nunca "approved",
  // porque entrar en edición ya lo había desaprobado.
  function cancelEditSlide(order: number) {
    setSlides((prev) =>
      prev.map((s) => (s.order === order ? { ...s, draftText: s.text, status: "pending", error: null } : s)),
    );
  }

  async function applySlideEdit(order: number) {
    const slide = slides.find((s) => s.order === order);
    if (!slide) return;
    patchSlide(order, { status: "applying", error: null });
    try {
      const renderer = new StaticSlideRenderer();
      const blob = await renderer.render({
        imageUrl: slide.originalImageUrl ?? undefined,
        text: slide.draftText,
        role: slide.role,
        slideIndex: order,
        style: style ?? undefined,
        handle: channelHandle ?? undefined,
      });
      const { url } = await uploadFile(blob, `slide_${order}.jpg`);
      patchSlide(order, { text: slide.draftText, renderedImageUrl: url, status: "pending", error: null });
    } catch (e) {
      patchSlide(order, {
        status: "editing",
        error: e instanceof Error ? e.message : "No se pudo aplicar el cambio. Intenta de nuevo.",
      });
    }
  }

  // Pide a la IA un texto nuevo SOLO para este slide (source "ai" — no hay foto que
  // reanalizar) y re-renderiza/re-sube igual que applySlideEdit, pero sin pasar por el
  // modo edición (el botón vive en la vista normal de la tarjeta). Reset a "pending"
  // como cualquier cambio de texto: hay que volver a aprobar.
  async function regenerateSlide(order: number) {
    const slide = slides.find((s) => s.order === order);
    if (!slide || slide.source !== "ai") return;
    const ordered = [...slides].sort((a, b) => a.order - b.order);
    const currentPos = ordered.findIndex((s) => s.order === order);
    // Foto inmediatamente anterior en el orden final del carrusel (si la hay) — mismo
    // criterio que CarouselComposerAgent usa al intercalar foto/texto-IA, para que el
    // texto regenerado siga anclado a esa foto en vez de partir de cero.
    const precedingPhoto = currentPos > 0 && ordered[currentPos - 1].source === "client" ? ordered[currentPos - 1] : null;

    patchSlide(order, { status: "regenerating", error: null });
    try {
      const res = await fetch("/api/socialflow/carousel/regenerate-slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
          slideIndex: order,
          role: slide.role,
          theme: THEME_OPTIONS.find((o) => o.value === carouselTheme)?.sendValue ?? "auto",
          currentText: slide.text,
          precedingPhotoContext: precedingPhoto ? slideAnalyses[precedingPhoto.order]?.specificContext ?? null : null,
        }),
      });
      const data = (await res.json()) as { text?: string; message?: string };
      if (!res.ok || !data.text) {
        throw new Error(data.message ?? "No se pudo regenerar el texto.");
      }

      const renderer = new StaticSlideRenderer();
      const blob = await renderer.render({
        text: data.text,
        role: slide.role,
        slideIndex: order,
        style: style ?? undefined,
        handle: channelHandle ?? undefined,
      });
      const { url } = await uploadFile(blob, `slide_${order}.jpg`);
      patchSlide(order, { text: data.text, draftText: data.text, renderedImageUrl: url, status: "pending", error: null });
    } catch (e) {
      patchSlide(order, {
        status: "pending",
        error: e instanceof Error ? e.message : "No se pudo regenerar el texto. Intenta de nuevo.",
      });
    }
  }

  function rejectSlide(order: number) {
    patchSlide(order, { status: "rejected_awaiting_replacement", error: null });
  }

  // El texto/imagen ya estaban intactos (rejectSlide nunca los tocó) — solo hace
  // falta volver el status a "pending" para que la tarjeta muestre lo que ya había.
  function undoReject(order: number) {
    patchSlide(order, { status: "pending", error: null });
  }

  // Confirmado con el usuario: se recompone el set COMPLETO (foto nueva + N-1
  // originales, reusando su análisis ya cacheado para no re-llamar a LLaVA en ellas)
  // pero solo se APLICA el texto del slide reemplazado — el resto conserva su texto
  // local (editado o no) tal cual, nunca se sobreescribe.
  async function replaceSlidePhoto(order: number, file: File) {
    patchSlide(order, { status: "replacing", error: null });
    try {
      const { url, key } = await uploadFile(file);
      const ordered = [...slides].sort((a, b) => a.order - b.order);
      // Solo los slides "client" viajan a reanálisis — un slide "ai" (carrusel mixto)
      // no tiene foto que reanalizar y este flujo de todos modos no lo toca (solo se
      // aplica el texto del slide reemplazado, ver comentario de la función). Sin este
      // filtro, un originalImageUrl/Key null de un slide IA rompería la validación del
      // backend. Este botón solo es alcanzable en slides "client" (ver CarouselSlideCard).
      const clientSlides = ordered.filter((s) => s.source === "client");
      const replaceIndex = clientSlides.findIndex((s) => s.order === order);
      const imageUrls = clientSlides.map((s) => (s.order === order ? url : s.originalImageUrl!));
      const imageKeys = clientSlides.map((s) => (s.order === order ? key : s.originalImageKey!));
      const imageAnalysesPayload = clientSlides.map((s) => (s.order === order ? undefined : slideAnalyses[s.order]));

      const res = await fetch("/api/socialflow/posts/generate-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
          forcedContentType: "CAROUSEL",
          imageUrls,
          imageKeys,
          imageAnalyses: imageAnalysesPayload,
        }),
      });
      const data = (await res.json()) as {
        suggestedCarouselPost?: SuggestedCarouselPost;
        imageAnalyses?: ImageAnalysis[];
        code?: string;
        message?: string;
      };

      if (!res.ok || !data.suggestedCarouselPost) {
        patchSlide(order, {
          status: "rejected_awaiting_replacement",
          error:
            data.code === "CAROUSEL_SLIDE_ANALYSIS_FAILED"
              ? "La foto de reemplazo no se pudo analizar. Intenta con otra."
              : data.message ?? "No se pudo procesar la foto de reemplazo.",
        });
        return;
      }

      if (data.imageAnalyses) {
        setSlideAnalyses((prev) => {
          const next = [...prev];
          next[order] = data.imageAnalyses![replaceIndex];
          return next;
        });
      }

      const finalText = data.suggestedCarouselPost.slides[replaceIndex]?.text ?? "";
      const role = ordered.find((s) => s.order === order)!.role;
      const renderer = new StaticSlideRenderer();
      const blob = await renderer.render({
        imageUrl: url,
        text: finalText,
        role,
        slideIndex: order,
        style: style ?? undefined,
        handle: channelHandle ?? undefined,
      });
      const { url: renderedUrl } = await uploadFile(blob, `slide_${order}.jpg`);

      patchSlide(order, {
        originalImageUrl: url,
        originalImageKey: key,
        text: finalText,
        draftText: finalText,
        renderedImageUrl: renderedUrl,
        status: "pending",
        error: null,
      });
    } catch (e) {
      patchSlide(order, {
        status: "rejected_awaiting_replacement",
        error: e instanceof Error ? e.message : "No se pudo reemplazar la foto. Intenta de nuevo.",
      });
    }
  }

  async function saveCarousel() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const ordered = [...slides].sort((a, b) => a.order - b.order);
      const introSlide = ordered.find((s) => s.role === "intro");
      const title = (introSlide?.text ?? ordered[0]?.text ?? "").slice(0, 72);
      // Descripción de Instagram editable por el cliente (CAMBIO 2) — ya no se
      // concatenan los textos de los slides como caption; fallback defensivo por si
      // llega vacío (no debería, se precarga desde suggestedCarouselPost.caption).
      const body = caption.trim() || ordered.map((s) => s.text).join("\n\n");

      const res = await fetch("/api/socialflow/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
          provider: "INSTAGRAM",
          contentType: "CAROUSEL",
          title,
          body,
          imageHint: ordered[0]?.renderedImageUrl ?? null,
          status: "SCHEDULED",
          scheduledAt,
          metadata: {
            slides: ordered.map((s) => ({ order: s.order, imageUrl: s.renderedImageUrl, text: s.text, role: s.role })),
            hashtags,
            carouselIndex,
            styleVariantKey: style?.key ?? null,
          },
        }),
      });
      const data = (await res.json()) as { post?: unknown; message?: string; code?: string };
      if (!res.ok || !data.post) {
        throw new Error(data.message ?? data.code ?? "No se pudo guardar el carrusel.");
      }
      setPhase("saved");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "No se pudo guardar el carrusel.");
    } finally {
      setIsSaving(false);
    }
  }

  // ── idle: selector de fotos ──────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div className="space-y-6">
        <p className="text-sm leading-6 text-white/50">
          Sube tus fotos y la IA generará el texto de cada slide. Revisa y aprueba cada slide antes de publicar.
        </p>

        <div
          className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-white/15 bg-white/3 px-6 py-14 text-center transition hover:border-violet-500/40"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void handleFileSelect(e.dataTransfer.files); }}
        >
          <IcoUpload />
          <p className="text-sm font-semibold text-white/70">Arrastra tus fotos aquí o</p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5 hover:brightness-110"
          >
            Elegir fotos
          </button>
          <p className="mt-1 text-xs text-white/30">
            Entre {CAROUSEL_MIN_SLIDES} y {maxSlides} fotos según tu plan · JPEG, PNG, WebP
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => { void handleFileSelect(e.target.files); e.target.value = ""; }}
          />
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-300">{error}</div>
        )}

        {photos.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
              {photos.map((p, i) => (
                <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl ring-2 ring-white/8">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                  <span className="absolute left-1 top-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePhoto(p.id)}
                    className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white/70 opacity-0 transition hover:text-rose-300 group-hover:opacity-100"
                  >
                    <IcoX />
                  </button>
                </div>
              ))}
            </div>

            {canGenerate && aiSlides > 0 && (
              <p className="flex items-center gap-2 rounded-2xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-200">
                <span className="text-lg" aria-hidden>✦</span>
                La IA completará {aiSlides} slide{aiSlides !== 1 ? "s" : ""} de texto para llegar a las {maxSlides} slides de tu plan.
              </p>
            )}

            <p className="text-sm font-medium text-white/60">{photoCounterLabel()}</p>
          </>
        )}

        {photos.length > 0 && (
          <div className="sticky bottom-0 z-10 -mx-1 space-y-3 rounded-2xl border border-white/10 bg-[#050510]/95 p-3 shadow-2xl shadow-black/40 backdrop-blur-md">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-white/50">Tema del carrusel</p>
              <div className="flex flex-wrap gap-1.5">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCarouselTheme(opt.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      carouselTheme === opt.value
                        ? "border-violet-500/60 bg-violet-500/20 text-violet-200"
                        : "border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled={!canGenerate}
              onClick={generateCarousel}
              className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-40 disabled:hover:translate-y-0"
            >
              Generar carrusel
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── uploading / composing / rendering: progreso ──────────────────────────
  if (phase === "uploading" || phase === "composing" || phase === "rendering") {
    const label =
      phase === "uploading" ? "Subiendo fotos…" :
      phase === "composing" ? "Analizando fotos y componiendo el carrusel…" :
      "Renderizando slides…";
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/3 py-20 text-center">
        <Spinner />
        <p className="text-sm font-semibold text-white/70">{label}</p>
      </div>
    );
  }

  // ── saved: confirmación tras guardar ──────────────────────────────────────
  if (phase === "saved") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 py-16 text-center">
        <span className="text-4xl">✅</span>
        <p className="text-lg font-black text-white">Carrusel guardado</p>
        <p className="max-w-sm text-sm text-white/50">Se publicará automáticamente en la fecha programada.</p>
        <button
          type="button"
          onClick={() => router.push("/socialflow/plan")}
          className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5 hover:brightness-110"
        >
          Ver en el calendario
        </button>
      </div>
    );
  }

  // ── error ─────────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
        {failedSlides.length > 0 && (
          <ul className="space-y-1 text-xs text-rose-300/80">
            {failedSlides.map((f) => (
              <li key={f.order}>Foto {f.order + 1}: {f.message}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => setPhase("idle")}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/10"
        >
          Volver a intentar
        </button>
      </div>
    );
  }

  // ── review: aprobar/editar/rechazar por slide + guardar ──────────────────
  const approvedCount = slides.filter((s) => s.status === "approved").length;
  const pendingReplacements = slides.filter(
    (s) => s.status === "rejected_awaiting_replacement" || s.status === "replacing",
  ).length;
  const canSave = slides.length > 0 && pendingReplacements === 0 && approvedCount === slides.length;
  return (
    <div className="space-y-6">
      <p className="text-xs text-white/40">
        {approvedCount}/{slides.length} slides aprobados
      </p>
      {styleLabel && (
        <p className="text-[11px] text-white/25">Estilo visual: {styleLabel}</p>
      )}
      {pendingReplacements > 0 && (
        <p className="text-xs font-semibold text-amber-400">
          Falta reemplazar {pendingReplacements} foto{pendingReplacements !== 1 ? "s" : ""} antes de poder guardar.
        </p>
      )}
      {viralScore && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${VIRAL_SCORE_STYLES[viralScore.label]}`}>
          Score de viralidad: {viralScore.score}/10 ({viralScore.label})
          {viralScore.improvements[0] ? ` — ${viralScore.improvements[0]}` : ""}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {slides.map((slide) => (
          <CarouselSlideCard
            key={slide.order}
            slide={slide}
            onApprove={() => approveSlide(slide.order)}
            onStartEdit={() => startEditSlide(slide.order)}
            onCancelEdit={() => cancelEditSlide(slide.order)}
            onDraftChange={(value) => updateDraftText(slide.order, value)}
            onApplyEdit={() => applySlideEdit(slide.order)}
            onReject={() => rejectSlide(slide.order)}
            onReplacePhoto={(file) => replaceSlidePhoto(slide.order, file)}
            onUndoReject={() => undoReject(slide.order)}
            onRegenerate={() => regenerateSlide(slide.order)}
          />
        ))}
      </div>
      {!canSave && pendingReplacements === 0 && (
        <p className="text-center text-xs text-white/30">Aprueba todos los slides para poder guardar.</p>
      )}
      <div className="space-y-1.5">
        <label htmlFor="carousel-caption" className="text-xs font-semibold text-white/50">
          Descripción de Instagram (editable)
        </label>
        <textarea
          id="carousel-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={CAROUSEL_CAPTION_MAX_LENGTH}
          rows={5}
          className="w-full resize-y rounded-xl border border-white/10 bg-white/3 px-3 py-2.5 text-sm text-white/80 outline-none transition focus:border-violet-400/40"
        />
        <p className="text-right text-[11px] text-white/25">{caption.length}/{CAROUSEL_CAPTION_MAX_LENGTH}</p>
      </div>
      {saveError && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-300">{saveError}</div>
      )}
      <button
        type="button"
        disabled={!canSave || isSaving}
        onClick={saveCarousel}
        className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-40 disabled:hover:translate-y-0"
      >
        {isSaving ? "Guardando…" : "Guardar carrusel"}
      </button>
    </div>
  );
}
