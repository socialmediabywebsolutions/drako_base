"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ImageAnalysis } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";

// ── Types ─────────────────────────────────────────────────────────────────────

type SuggestedPost = {
  title: string;
  body: string;
  hashtags: string[];
  imageHint: string;
  provider: string;
  contentType: string;
  scheduledAt: string;
  saasId: string;
};

type GenerateResult = {
  imageUrl: string;
  imageAnalysis: ImageAnalysis;
  suggestedPost: SuggestedPost;
};

type Step = "idle" | "uploading" | "analyzing" | "ready" | "saving" | "saved";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toIsoString(date: string, time: string): string {
  return `${date}T${time || "09:00"}:00.000Z`;
}

function parseDate(iso: string): string {
  return iso.slice(0, 10);
}

function parseTime(iso: string): string {
  return iso.slice(11, 16);
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  FEED: "Feed",
  REEL: "Reel",
  STORY: "Story",
};

const PROVIDER_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
};

// ── Icons ─────────────────────────────────────────────────────────────────────

function IcoUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function IcoSparkles() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
    </svg>
  );
}

function IcoCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function IcoPencil() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
    </svg>
  );
}

function IcoReset() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function UploadToPost({ saasId }: { saasId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null);

  // Editable post fields
  const [editBody, setEditBody] = useState("");
  const [editHashtags, setEditHashtags] = useState<string[]>([]);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editContentType, setEditContentType] = useState("FEED");
  const [editProvider, setEditProvider] = useState("INSTAGRAM");
  const [isEditing, setIsEditing] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Solo se aceptan imágenes (JPEG, PNG, WebP, GIF).");
      return;
    }
    setError(null);
    setStep("uploading");

    try {
      // Phase 1: upload to R2
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/socialflow/media/upload", { method: "POST", body: form });
      const uploadData = (await uploadRes.json()) as { url?: string; key?: string; message?: string; error?: string };
      if (!uploadRes.ok || !uploadData.url || !uploadData.key) {
        throw new Error(uploadData.message ?? uploadData.error ?? "Error al subir la imagen.");
      }
      setImageUrl(uploadData.url);

      // Phase 2: generate post from image
      setStep("analyzing");
      const genRes = await fetch("/api/socialflow/posts/generate-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: uploadData.url, imageKey: uploadData.key, saasId }),
      });
      const genData = (await genRes.json()) as GenerateResult & { code?: string; message?: string };
      if (!genRes.ok || !genData.suggestedPost) {
        throw new Error(genData.message ?? genData.code ?? "Error al generar el post.");
      }

      // Populate editable fields
      setImageAnalysis(genData.imageAnalysis);
      setEditBody(genData.suggestedPost.body);
      setEditHashtags(genData.suggestedPost.hashtags);
      setEditDate(parseDate(genData.suggestedPost.scheduledAt));
      setEditTime(parseTime(genData.suggestedPost.scheduledAt));
      setEditContentType(genData.suggestedPost.contentType);
      setEditProvider(genData.suggestedPost.provider);
      setStep("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrió un error inesperado.");
      setStep("idle");
      setImageUrl(null);
    }
  }

  async function handleApprove() {
    if (!imageUrl) return;
    setStep("saving");
    setError(null);
    try {
      const title = editBody.split("\n")[0]?.replace(/^#+\s*/, "").slice(0, 72).trim() ?? "Post";
      const bodyWithHashtags = editHashtags.length
        ? `${editBody}\n\n${editHashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
        : editBody;

      const res = await fetch("/api/socialflow/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
          provider: editProvider,
          contentType: editContentType,
          title,
          body: bodyWithHashtags,
          imageHint: imageUrl,
          status: "SCHEDULED",
          scheduledAt: toIsoString(editDate, editTime),
        }),
      });
      const data = (await res.json()) as { post?: { id: string }; code?: string; message?: string };
      if (!res.ok || !data.post) {
        throw new Error(data.message ?? data.code ?? "Error al guardar el post.");
      }
      setStep("saved");
      setTimeout(() => router.push("/socialflow/plan"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar el post.");
      setStep("ready");
    }
  }

  function handleReset() {
    setStep("idle");
    setError(null);
    setImageUrl(null);
    setImageAnalysis(null);
    setEditBody("");
    setEditHashtags([]);
    setIsEditing(false);
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  // ── Drop zone ────────────────────────────────────────────────────────────────

  if (step === "idle") {
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
            const file = e.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={[
            "flex cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed p-16 text-center transition-all",
            isDragging
              ? "border-violet-500/60 bg-violet-500/10"
              : "border-white/12 bg-white/3 hover:border-violet-500/40 hover:bg-violet-500/5",
          ].join(" ")}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 text-violet-400">
            <IcoUpload />
          </div>
          <div>
            <p className="text-base font-bold text-white/80">Arrastra tu foto aquí</p>
            <p className="mt-1 text-sm text-white/40">o haz click para seleccionar</p>
            <p className="mt-3 text-xs text-white/25">JPEG, PNG, WebP, GIF · máx. 200 MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>

        <div className="rounded-2xl border border-white/6 bg-white/3 px-5 py-4">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-white/25">Cómo funciona</p>
          <ol className="space-y-2">
            {[
              "Sube una foto de tu trabajo, producto, equipo o espacio.",
              "La IA analiza la imagen y entiende el contexto visual.",
              "Genera un caption optimizado, hashtags y fecha/hora ideales para tu nicho.",
              "Aprueba directamente o edita antes de programar.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/45">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-black text-violet-400">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  // ── Loading states ────────────────────────────────────────────────────────────

  if (step === "uploading" || step === "analyzing") {
    return (
      <div className="flex flex-col items-center justify-center gap-5 rounded-3xl border border-white/8 bg-white/3 py-24">
        <Spinner />
        <div className="text-center">
          <p className="text-base font-bold text-white/80">
            {step === "uploading" ? "Subiendo imagen…" : "Analizando con IA…"}
          </p>
          <p className="mt-1 text-sm text-white/35">
            {step === "uploading"
              ? "Guardando en almacenamiento seguro."
              : "LLaVA analiza la imagen · Mistral genera el caption"}
          </p>
        </div>
        {step === "analyzing" && imageUrl && (
          <div className="h-24 w-24 overflow-hidden rounded-2xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Preview" className="h-full w-full object-cover" />
          </div>
        )}
      </div>
    );
  }

  // ── Saved ─────────────────────────────────────────────────────────────────────

  if (step === "saved") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 py-20">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
          <IcoCheck />
        </div>
        <div className="text-center">
          <p className="text-base font-bold text-emerald-300">Post programado</p>
          <p className="mt-1 text-sm text-white/40">Redirigiendo al calendario…</p>
        </div>
      </div>
    );
  }

  // ── Ready: show result ────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-white/8 bg-white/3">
        <div className="flex flex-col gap-0 md:flex-row">

          {/* Left: image + analysis */}
          <div className="flex shrink-0 flex-col gap-4 border-b border-white/8 p-5 md:w-72 md:border-b-0 md:border-r">
            {imageUrl && (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Imagen subida" className="w-full object-cover" style={{ maxHeight: 280 }} />
              </div>
            )}

            {imageAnalysis && (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/25">
                  Análisis IA
                </p>
                <div className="space-y-2">
                  <div className="rounded-xl bg-white/5 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Contexto</p>
                    <p className="mt-0.5 text-sm text-white/70">{imageAnalysis.context}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Emoción</p>
                    <p className="mt-0.5 text-sm text-white/70">{imageAnalysis.emotion}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Descripción</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-white/60">{imageAnalysis.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {imageAnalysis.suggestedThemes.map((theme) => (
                      <span
                        key={theme}
                        className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-medium text-violet-300"
                      >
                        {theme}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: generated post */}
          <div className="flex flex-1 flex-col gap-5 p-5">
            {/* Format + Provider badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-xs font-bold text-fuchsia-300">
                {PROVIDER_LABELS[editProvider] ?? editProvider}
              </span>
              <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold text-violet-300">
                {CONTENT_TYPE_LABELS[editContentType] ?? editContentType}
              </span>
              <div className="flex items-center gap-1 rounded-full bg-white/8 px-3 py-1">
                <IcoSparkles />
                <span className="text-xs font-semibold text-white/50">Generado por IA</span>
              </div>
            </div>

            {/* Caption */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Caption</p>
                <button
                  type="button"
                  onClick={() => setIsEditing((v) => !v)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-white/45 transition hover:border-white/20 hover:text-white/70"
                >
                  <IcoPencil />
                  {isEditing ? "Vista previa" : "Editar"}
                </button>
              </div>
              {isEditing ? (
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={8}
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-relaxed text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
              ) : (
                <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">{editBody}</p>
                </div>
              )}
            </div>

            {/* Hashtags */}
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/30">
                Hashtags ({editHashtags.length}/15)
              </p>
              {isEditing ? (
                <textarea
                  value={editHashtags.join(" ")}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (!raw) { setEditHashtags([]); return; }
                    const tags = raw.split(/\s+/).map((t) => t.startsWith("#") ? t : `#${t}`).slice(0, 15);
                    setEditHashtags(tags);
                  }}
                  rows={2}
                  placeholder="#hashtag1 #hashtag2 …"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {editHashtags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white/8 px-2.5 py-1 text-xs font-medium text-violet-300">
                      {tag.startsWith("#") ? tag : `#${tag}`}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Schedule */}
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/30">
                Fecha y hora de publicación
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  value={editDate}
                  min={todayStr()}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-32 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
                <select
                  value={editProvider}
                  onChange={(e) => setEditProvider(e.target.value)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                >
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="LINKEDIN">LinkedIn</option>
                </select>
                <select
                  value={editContentType}
                  onChange={(e) => setEditContentType(e.target.value)}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                >
                  <option value="FEED">Feed</option>
                  <option value="REEL">Reel</option>
                  <option value="STORY">Story</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-white/8 px-5 py-4">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-4 py-2.5 text-sm text-white/45 transition hover:bg-white/8 hover:text-white/70"
          >
            <IcoReset />
            Subir otra foto
          </button>

          <button
            type="button"
            onClick={() => void handleApprove()}
            disabled={step === "saving" || !editDate || !editBody.trim()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {step === "saving" ? (
              <>
                <Spinner />
                Programando…
              </>
            ) : (
              <>
                <IcoCheck />
                Aprobar y programar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
