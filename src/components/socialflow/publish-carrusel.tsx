"use client";

import { useRef, useState } from "react";
import type { CarouselSlideRole } from "@/lib/socialflow/ai/agents/CarouselComposerAgent";
import { StaticSlideRenderer } from "@/lib/socialflow/carousel/StaticSlideRenderer";

// Mismo límite real de la Graph API que ya aplica el backend (CAROUSEL_MIN_ITEMS en
// meta/publishing.ts) — duplicado aquí como número simple para no meter ese módulo
// server-only (decryptToken, llamadas a graph.facebook.com) en el bundle de cliente.
const CAROUSEL_MIN_SLIDES = 2;

type Phase = "idle" | "uploading" | "composing" | "rendering" | "review" | "error";

type CarouselPhotoSlot = {
  id: string;
  file: File;
  previewUrl: string;
};

// "pending": recién generado o recién editado — sin aprobar todavía.
// "approved": listo para guardar.
// "editing": textarea abierto, draftText puede diferir de text.
// "applying": re-renderizando + subiendo el nuevo compuesto a R2.
type SlideReviewStatus = "pending" | "approved" | "editing" | "applying";

type CarouselSlideState = {
  order: number;
  role: CarouselSlideRole;
  originalImageUrl: string;
  renderedImageUrl: string | null;
  text: string;        // texto YA aplicado — el que está quemado en renderedImageUrl
  draftText: string;   // valor del textarea mientras se edita, separado de `text`
  status: SlideReviewStatus;
  error: string | null; // error de re-render de ESTE slide, no del carrusel completo
};

type FailedSlide = { order: number; imageKey?: string; message: string };

const ROLE_LABEL: Record<CarouselSlideRole, string> = {
  intro: "Intro",
  desarrollo: "Desarrollo",
  cierre_cta: "Cierre / CTA",
};

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

type SuggestedCarouselPost = {
  title: string;
  hashtags: string[];
  provider: string;
  contentType: "CAROUSEL";
  scheduledAt: string;
  saasId: string;
  slides: { order: number; imageUrl: string; text: string; role: CarouselSlideRole }[];
};

// ── Tarjeta de revisión de un slide (mirror de ReelItemCard en publish-reel.tsx) ──

function CarouselSlideCard({
  slide,
  onApprove,
  onStartEdit,
  onCancelEdit,
  onDraftChange,
  onApplyEdit,
}: {
  slide: CarouselSlideState;
  onApprove: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onDraftChange: (value: string) => void;
  onApplyEdit: () => void;
}) {
  const isEditing = slide.status === "editing" || slide.status === "applying";
  const isApplying = slide.status === "applying";

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/3">
      <div className="relative">
        {slide.renderedImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={slide.renderedImageUrl} alt="" className="aspect-[4/5] w-full object-cover" />
        )}
        {slide.status === "approved" && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-emerald-500/90 px-2 py-0.5 text-[10px] font-black text-white">
            <IcoCheck /> Aprobado
          </span>
        )}
      </div>

      <div className="space-y-2 px-3 py-3">
        <span className="text-[10px] font-black uppercase tracking-wide text-violet-400">
          {ROLE_LABEL[slide.role]}
        </span>

        {isEditing ? (
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
                  onClick={onApprove}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-emerald-500 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-400"
                >
                  <IcoCheck /> Aprobar
                </button>
              )}
              <button
                type="button"
                onClick={onStartEdit}
                className={[
                  "flex items-center justify-center gap-1 rounded-lg border border-white/10 py-1.5 text-[11px] text-white/60 transition hover:text-white/90",
                  slide.status === "approved" ? "flex-1" : "px-3",
                ].join(" ")}
              >
                <IcoPencil /> Editar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function PublishCarrusel({ saasId, maxSlides = 6 }: { saasId: string; maxSlides?: number }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [photos, setPhotos] = useState<CarouselPhotoSlot[]>([]);
  const [slides, setSlides] = useState<CarouselSlideState[]>([]);
  const [, setHashtags] = useState<string[]>([]);
  const [, setScheduledAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedSlides, setFailedSlides] = useState<FailedSlide[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canGenerate = photos.length >= CAROUSEL_MIN_SLIDES && photos.length <= maxSlides;

  function handleFileSelect(files: FileList | null) {
    if (!files || files.length === 0) return;
    const available = maxSlides - photos.length;
    if (available <= 0) {
      setError(`Límite de ${maxSlides} fotos alcanzado para tu plan.`);
      return;
    }
    const incoming = Array.from(files).slice(0, available);
    if (files.length > incoming.length) {
      setError(`Solo se añadieron ${incoming.length} de ${files.length} fotos (límite de tu plan: ${maxSlides}).`);
    } else {
      setError(null);
    }
    const newSlots: CarouselPhotoSlot[] = incoming.map((file) => ({
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
        }),
      });
      const data = (await res.json()) as {
        suggestedCarouselPost?: SuggestedCarouselPost;
        code?: string;
        message?: string;
        failedSlides?: FailedSlide[];
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
      setScheduledAt(post.scheduledAt);

      setPhase("rendering");
      const renderer = new StaticSlideRenderer();
      const rendered = await Promise.all(
        post.slides.map(async (slide) => {
          const blob = await renderer.render({ imageUrl: slide.imageUrl, text: slide.text, role: slide.role });
          const { url } = await uploadFile(blob, `slide_${slide.order}.jpg`);
          return {
            order: slide.order,
            role: slide.role,
            originalImageUrl: slide.imageUrl,
            renderedImageUrl: url,
            text: slide.text,
            draftText: slide.text,
            status: "pending",
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
      const blob = await renderer.render({ imageUrl: slide.originalImageUrl, text: slide.draftText, role: slide.role });
      const { url } = await uploadFile(blob, `slide_${order}.jpg`);
      patchSlide(order, { text: slide.draftText, renderedImageUrl: url, status: "pending", error: null });
    } catch (e) {
      patchSlide(order, {
        status: "editing",
        error: e instanceof Error ? e.message : "No se pudo aplicar el cambio. Intenta de nuevo.",
      });
    }
  }

  // ── idle: selector de fotos ──────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div className="space-y-6">
        <div
          className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-white/15 bg-white/3 px-6 py-14 text-center transition hover:border-violet-500/40"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFileSelect(e.dataTransfer.files); }}
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
            onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ""; }}
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

            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40">
                {photos.length}/{maxSlides} fotos
                {!canGenerate && photos.length < CAROUSEL_MIN_SLIDES && ` · mínimo ${CAROUSEL_MIN_SLIDES}`}
              </p>
              <button
                type="button"
                disabled={!canGenerate}
                onClick={generateCarousel}
                className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-40 disabled:hover:translate-y-0"
              >
                Generar carrusel
              </button>
            </div>
          </>
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

  // ── review: aprobar/editar por slide — rechazar+reemplazo y el guardado final son piezas aparte ──
  const approvedCount = slides.filter((s) => s.status === "approved").length;
  return (
    <div className="space-y-6">
      <p className="text-xs text-white/40">
        {approvedCount}/{slides.length} slides aprobados
      </p>
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
          />
        ))}
      </div>
      <p className="text-center text-xs text-white/30">
        Rechazar + reemplazo y guardar el carrusel — próximas piezas.
      </p>
    </div>
  );
}
