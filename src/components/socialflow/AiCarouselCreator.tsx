"use client";

import { useEffect, useState } from "react";
import type { CarouselSlideRole } from "@/lib/socialflow/ai/agents/CarouselComposerAgent";
import { StaticSlideRenderer } from "@/lib/socialflow/carousel/StaticSlideRenderer";
import { getNichoPackKey, type CarouselNichePackKey, type CarouselStyleVariant } from "@/lib/socialflow/carousel/CarouselStylePacks";

// Modo "Crear con IA" del carrusel (Fase 7, sin fotos) — hermano de PublishCarrusel
// (publish-carrusel.tsx, modo "Subir imágenes"), mismo reparto de trabajo servidor/
// cliente: /api/socialflow/posts/generate-ai-carousel compone el texto y resuelve el
// estilo, aquí se renderiza cada slide (StaticSlideRenderer necesita Canvas del
// navegador, no puede vivir en la ruta server — ver esa ruta) y se sube a R2 antes de
// la revisión final. A diferencia de PublishCarrusel, no hay "reemplazar foto" (no hay
// foto que reemplazar) — la única edición posible por slide es el texto.

// Mismo mínimo real que exige la Graph API (CAROUSEL_MIN_ITEMS en meta/publishing.ts) —
// duplicado aquí como número simple para no meter ese módulo server-only (decryptToken,
// llamadas a graph.facebook.com) en el bundle de cliente. Mismo criterio que ya usa
// publish-carrusel.tsx (CAROUSEL_MIN_SLIDES).
const CAROUSEL_MIN_SLIDES = 2;

type Phase = "idle" | "generating" | "review" | "saving" | "saved" | "error";

type AiSlideState = {
  order: number;
  role: CarouselSlideRole;
  text: string;       // texto YA aplicado — el que está quemado en renderedImageUrl
  draftText: string;  // valor del textarea, puede diferir de text mientras se edita
  renderedImageUrl: string | null;
  status: "ready" | "rendering" | "error";
  error: string | null;
};

const ROLE_LABEL: Record<CarouselSlideRole, string> = {
  intro: "Intro",
  desarrollo: "Desarrollo",
  cierre_cta: "Cierre / CTA",
};

// Valor centinela para "sin tema explícito" — se traduce a `theme: undefined` en el
// body, que el endpoint ya sabe resolver a KB/nicho (ver generate-ai-carousel/route.ts).
const AUTO_TOPIC = "__auto__";

// Mismos 4 packs que CarouselStylePacks.ts (fitness/psicologia/educacion/food) — un
// listado de temas de ejemplo por nicho, no una taxonomía cerrada: el cliente siempre
// puede dejar que la IA decida en su lugar.
const TOPIC_OPTIONS_BY_PACK: Record<CarouselNichePackKey, string[]> = {
  fitness: ["Rutina de ejercicio", "Nutrición", "Mito fitness", "Motivación", "Técnica de entrenamiento"],
  psicologia: ["Autoestima", "Ansiedad", "Relaciones", "Frases de poder", "Hábitos mentales"],
  educacion: ["Concepto clave", "Dato curioso", "Error común", "Consejo práctico", "Pregunta reflexiva"],
  food: ["Receta", "Ingrediente estrella", "Técnica culinaria", "Historia del plato", "Maridaje"],
};

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// Duplicado de la función homónima en publish-carrusel.tsx (no exportada ahí) — mismo
// patrón de subida de un Blob renderizado a R2.
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

type GenerateAiCarouselResponse = {
  channelHandle?: string | null;
  style?: CarouselStyleVariant;
  styleLabel?: string;
  suggestedCarouselPost?: {
    hashtags: string[];
    scheduledAt: string;
    slides: { order: number; text: string; role: CarouselSlideRole }[];
  };
  code?: string;
  message?: string;
};

export default function AiCarouselCreator({ saasId, maxSlides }: { saasId: string; maxSlides: number }) {
  const [niche, setNiche] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string>(AUTO_TOPIC);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<AiSlideState[]>([]);
  const [style, setStyle] = useState<CarouselStyleVariant | null>(null);
  const [styleLabel, setStyleLabel] = useState<string>("");
  const [channelHandle, setChannelHandle] = useState<string | null>(null);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState<string>("");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Niche del cliente para elegir qué chips de tema mostrar — mismo endpoint que ya usa
  // el resto del panel de perfil. Fallo silencioso: sin niche, getNichoPackKey cae a su
  // propio catch-all ("educacion") y "La IA decide el tema" sigue disponible igual.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/socialflow/profile?saasId=${encodeURIComponent(saasId)}`);
        const data = (await res.json()) as { ok?: boolean; profile?: { niche?: string } };
        if (!cancelled && data.ok && data.profile?.niche) setNiche(data.profile.niche);
      } catch {
        // silencioso — ver comentario arriba.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [saasId]);

  const packKey = getNichoPackKey(niche ?? "");
  const topicOptions = TOPIC_OPTIONS_BY_PACK[packKey];
  const canGenerate = maxSlides >= CAROUSEL_MIN_SLIDES;

  async function generateCarousel() {
    setPhase("generating");
    setError(null);
    try {
      const res = await fetch("/api/socialflow/posts/generate-ai-carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
          theme: selectedTopic === AUTO_TOPIC ? undefined : selectedTopic,
          slideCount: maxSlides,
        }),
      });
      const data = (await res.json()) as GenerateAiCarouselResponse;
      if (!res.ok || !data.suggestedCarouselPost || !data.style) {
        setError(data.message ?? "No se pudo generar el carrusel.");
        setPhase("error");
        return;
      }

      const post = data.suggestedCarouselPost;
      const resolvedStyle = data.style;
      const resolvedHandle = data.channelHandle ?? null;
      setHashtags(post.hashtags);
      setScheduledAt(post.scheduledAt);
      setStyle(resolvedStyle);
      setStyleLabel(data.styleLabel ?? "");
      setChannelHandle(resolvedHandle);

      // Render + subida a R2 — StaticSlideRenderer necesita Canvas del navegador, por
      // eso vive aquí y no en el endpoint (ver generate-ai-carousel/route.ts).
      const renderer = new StaticSlideRenderer();
      const rendered = await Promise.all(
        post.slides.map(async (slide): Promise<AiSlideState> => {
          try {
            const blob = await renderer.render({
              text: slide.text,
              role: slide.role,
              slideIndex: slide.order,
              style: resolvedStyle,
              handle: resolvedHandle ?? undefined,
            });
            const { url } = await uploadFile(blob, `ai_slide_${slide.order}.jpg`);
            return {
              order: slide.order,
              role: slide.role,
              text: slide.text,
              draftText: slide.text,
              renderedImageUrl: url,
              status: "ready",
              error: null,
            };
          } catch (e) {
            return {
              order: slide.order,
              role: slide.role,
              text: slide.text,
              draftText: slide.text,
              renderedImageUrl: null,
              status: "error",
              error: e instanceof Error ? e.message : "No se pudo renderizar este slide.",
            };
          }
        }),
      );

      setSlides(rendered.sort((a, b) => a.order - b.order));
      setPhase("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar el carrusel.");
      setPhase("error");
    }
  }

  function updateDraft(order: number, value: string) {
    setSlides((prev) => prev.map((s) => (s.order === order ? { ...s, draftText: value } : s)));
  }

  // Re-renderiza y re-sube SOLO este slide con el texto editado — sin "reemplazar foto"
  // (no aplica en modo IA), es la única edición posible por slide.
  async function applySlideEdit(order: number) {
    const slide = slides.find((s) => s.order === order);
    if (!slide || !style) return;
    const trimmed = slide.draftText.trim();
    if (!trimmed || trimmed === slide.text) return;

    setSlides((prev) => prev.map((s) => (s.order === order ? { ...s, status: "rendering", error: null } : s)));
    try {
      const renderer = new StaticSlideRenderer();
      const blob = await renderer.render({ text: trimmed, role: slide.role, slideIndex: order, style, handle: channelHandle ?? undefined });
      const { url } = await uploadFile(blob, `ai_slide_${order}.jpg`);
      setSlides((prev) =>
        prev.map((s) => (s.order === order ? { ...s, text: trimmed, draftText: trimmed, renderedImageUrl: url, status: "ready" } : s)),
      );
    } catch (e) {
      setSlides((prev) =>
        prev.map((s) =>
          s.order === order
            ? { ...s, status: "error", error: e instanceof Error ? e.message : "No se pudo aplicar el cambio." }
            : s,
        ),
      );
    }
  }

  // Descarta el carrusel actual y vuelve al selector de tema — el cliente puede elegir
  // otro tema o repetir el mismo, la IA nunca da exactamente el mismo resultado dos veces.
  function regenerate() {
    setSlides([]);
    setStyle(null);
    setError(null);
    setSaveError(null);
    setPhase("idle");
  }

  async function approveAndSchedule() {
    if (!style) return;
    setPhase("saving");
    setSaveError(null);
    try {
      const ordered = [...slides].sort((a, b) => a.order - b.order);
      const introSlide = ordered.find((s) => s.role === "intro");
      const title = (introSlide?.text ?? ordered[0]?.text ?? "").slice(0, 72);
      const body = ordered.map((s) => s.text).join("\n\n");

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
          // Mismo patrón que ya usa publish-carrusel.tsx (saveCarousel) — slides ordenados
          // con la URL renderizada real de cada uno, más los hashtags y el estilo aplicado.
          metadata: {
            slides: ordered.map((s) => ({ order: s.order, imageUrl: s.renderedImageUrl, text: s.text, role: s.role })),
            hashtags,
            styleVariantKey: style.key,
          },
        }),
      });
      const data = (await res.json()) as { post?: { id: string }; message?: string; code?: string };
      if (!res.ok || !data.post) {
        throw new Error(data.message ?? data.code ?? "No se pudo guardar el carrusel.");
      }
      setPhase("saved");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "No se pudo guardar el carrusel.");
      setPhase("review");
    }
  }

  const allSlidesReady = slides.length > 0 && slides.every((s) => s.status === "ready");

  if (phase === "saved") {
    return (
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
        Carrusel programado ✓
      </div>
    );
  }

  if (phase === "idle" || phase === "generating" || phase === "error") {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-white/60">Elige el tema del carrusel</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedTopic(AUTO_TOPIC)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                selectedTopic === AUTO_TOPIC
                  ? "border-violet-500/60 bg-violet-500/20 text-violet-200"
                  : "border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70"
              }`}
            >
              ✨ La IA decide el tema
            </button>
            {topicOptions.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => setSelectedTopic(topic)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  selectedTopic === topic
                    ? "border-violet-500/60 bg-violet-500/20 text-violet-200"
                    : "border-white/10 text-white/50 hover:bg-white/5 hover:text-white/70"
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        {!canGenerate && <p className="text-xs text-amber-300">Tu plan no incluye el formato Carrusel.</p>}
        {error && <p className="text-xs text-rose-300">{error}</p>}

        <button
          type="button"
          disabled={!canGenerate || phase === "generating"}
          onClick={() => void generateCarousel()}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === "generating" ? (
            <>
              <Spinner /> Generando slides…
            </>
          ) : (
            "✨ Generar carrusel con IA"
          )}
        </button>
      </div>
    );
  }

  // phase === "review" | "saving"
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-white/40">{styleLabel}</p>
        <div className="flex flex-wrap gap-1.5">
          {hashtags.slice(0, 6).map((h) => (
            <span key={h} className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">
              {h}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {slides.map((slide) => (
          <div key={slide.order} className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/3">
            <div className="relative aspect-[4/5] overflow-hidden bg-black/30">
              {slide.renderedImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={slide.renderedImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Spinner />
                </div>
              )}
              {slide.status === "rendering" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Spinner />
                </div>
              )}
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/70">
                {ROLE_LABEL[slide.role]}
              </span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-3">
              <textarea
                value={slide.draftText}
                onChange={(e) => updateDraft(slide.order, e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
              {slide.error && <p className="text-[11px] text-rose-300">{slide.error}</p>}
              {slide.draftText.trim() !== slide.text && (
                <button
                  type="button"
                  disabled={slide.status === "rendering"}
                  onClick={() => void applySlideEdit(slide.order)}
                  className="self-start rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold text-violet-300 transition hover:bg-violet-500/20 disabled:opacity-50"
                >
                  {slide.status === "rendering" ? "Aplicando…" : "Aplicar cambio"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {saveError && <p className="text-xs text-rose-300">{saveError}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={regenerate}
          disabled={phase === "saving"}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 transition hover:text-white disabled:opacity-50"
        >
          ↻ Regenerar
        </button>
        <button
          type="button"
          disabled={!allSlidesReady || phase === "saving"}
          onClick={() => void approveAndSchedule()}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {phase === "saving" ? (
            <>
              <Spinner /> Programando…
            </>
          ) : (
            "✅ Aprobar y programar"
          )}
        </button>
      </div>
    </div>
  );
}
