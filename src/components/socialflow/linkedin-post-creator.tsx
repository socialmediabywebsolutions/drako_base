"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_CHARS = 3000;
const MAX_HASHTAGS = 5;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function toIsoString(date: string, time: string): string {
  return `${date}T${time || "09:00"}:00.000Z`;
}

function IcoLinkedIn() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.114 20.452H3.558V9h3.556v11.452z" />
    </svg>
  );
}

function IcoSparkles() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
    </svg>
  );
}

function IcoImage() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3 21h18a1.5 1.5 0 0 0 1.5-1.5V4.5A1.5 1.5 0 0 0 21 3H3a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 3 21ZM9 8.25a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
    </svg>
  );
}

function IcoX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function LinkedInPostCreator({ saasId }: { saasId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagDraft, setHashtagDraft] = useState("");

  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [r2Url, setR2Url] = useState<string | null>(null);
  const [r2Key, setR2Key] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [date, setDate] = useState(todayStr());
  const [time, setTime] = useState("09:00");

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  async function handleImageSelected(file: File) {
    setError(null);
    setUploadingImage(true);
    setImagePreviewUrl(URL.createObjectURL(file));
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/socialflow/media/upload", { method: "POST", body: form });
      const data = (await res.json()) as { url?: string; key?: string; message?: string; error?: string };
      if (!res.ok || !data.url || !data.key) {
        throw new Error(data.message ?? data.error ?? "Error al subir la imagen.");
      }
      setR2Url(data.url);
      setR2Key(data.key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al subir la imagen.");
      setImagePreviewUrl(null);
    } finally {
      setUploadingImage(false);
    }
  }

  function removeImage() {
    setImagePreviewUrl(null);
    setR2Url(null);
    setR2Key(null);
  }

  function addHashtag() {
    const raw = hashtagDraft.trim();
    if (!raw || hashtags.length >= MAX_HASHTAGS) return;
    const tag = raw.startsWith("#") ? raw : `#${raw}`;
    if (!hashtags.includes(tag)) setHashtags((prev) => [...prev, tag]);
    setHashtagDraft("");
  }

  function removeHashtag(tag: string) {
    setHashtags((prev) => prev.filter((h) => h !== tag));
  }

  async function generateWithAi() {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/socialflow/posts/generate-linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
          imageUrl: r2Url ?? undefined,
          imageKey: r2Key ?? undefined,
        }),
      });
      const data = (await res.json()) as { body?: string; hashtags?: string[]; message?: string; code?: string };
      if (!res.ok || typeof data.body !== "string") {
        throw new Error(data.message ?? data.code ?? "No se pudo generar el post.");
      }
      setText(data.body.slice(0, MAX_CHARS));
      setHashtags((data.hashtags ?? []).slice(0, MAX_HASHTAGS));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el post.");
    } finally {
      setGenerating(false);
    }
  }

  async function approveAndSchedule() {
    if (!text.trim()) {
      setError("Escribe o genera un texto antes de programar.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const title = text.split("\n")[0]?.slice(0, 72).trim() || "Post de LinkedIn";
      const bodyWithHashtags = hashtags.length ? `${text}\n\n${hashtags.join(" ")}` : text;
      const scheduledAt = toIsoString(date, time);

      const res = await fetch("/api/socialflow/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
          provider: "LINKEDIN",
          contentType: "FEED",
          title,
          body: bodyWithHashtags,
          imageHint: r2Url ?? null,
          status: "SCHEDULED",
          scheduledAt,
        }),
      });
      const data = (await res.json()) as { post?: { id: string }; code?: string; message?: string };
      if (!res.ok || !data.post) {
        throw new Error(data.message ?? data.code ?? "Error al guardar el post.");
      }
      setSavedAt(scheduledAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar el post.");
    } finally {
      setSaving(false);
    }
  }

  if (savedAt) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/4 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600/15 text-sky-400">
          <IcoLinkedIn />
        </div>
        <p className="text-lg font-bold text-white">Post de LinkedIn programado</p>
        <p className="mt-1 text-sm text-white/45">
          Se publicará el {new Date(savedAt).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setText("");
              setHashtags([]);
              removeImage();
              setSavedAt(null);
            }}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/60 transition hover:bg-white/5"
          >
            Crear otro post
          </button>
          <button
            type="button"
            onClick={() => router.push("/socialflow/plan")}
            className="rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/20 transition hover:brightness-110"
          >
            Ver próximas publicaciones
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600/15 text-sky-400">
          <IcoLinkedIn />
        </div>
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-400">Socialcors · LinkedIn</div>
          <h1 className="text-2xl font-black tracking-tight text-white">Crear Post para LinkedIn</h1>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 p-4 text-sm text-red-300">{error}</div>
      )}

      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/4 p-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold text-white/50">Texto del post</p>
            <span className={`text-[11px] ${text.length > MAX_CHARS ? "text-red-400" : "text-white/30"}`}>
              {text.length}/{MAX_CHARS}
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
            rows={3}
            placeholder="¿Qué quieres compartir con tu red profesional?"
            className="w-full resize-y rounded-xl border border-white/10 bg-white/3 px-3 py-2.5 text-sm text-white/85 placeholder:text-white/25 outline-none transition focus:border-sky-400/40"
          />
        </div>

        <button
          type="button"
          onClick={() => void generateWithAi()}
          disabled={generating || uploadingImage}
          className="flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-300 transition hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IcoSparkles />
          {generating ? "Generando…" : "Generar con IA"}
        </button>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-white/50">Imagen (opcional)</p>
          {imagePreviewUrl ? (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreviewUrl} alt="" className="h-32 w-32 rounded-xl object-cover" />
              {uploadingImage && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 text-xs text-white/70">
                  Subiendo…
                </div>
              )}
              <button
                type="button"
                onClick={removeImage}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/80 text-white/70 hover:text-white"
              >
                <IcoX />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-dashed border-white/15 px-4 py-2.5 text-sm text-white/45 transition hover:border-sky-400/40 hover:text-white/70"
            >
              <IcoImage />
              Añadir imagen
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) void handleImageSelected(e.target.files[0]); }}
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-white/50">
            Hashtags ({hashtags.length}/{MAX_HASHTAGS})
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {hashtags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-300"
              >
                {tag}
                <button type="button" onClick={() => removeHashtag(tag)} className="text-sky-300/60 hover:text-sky-200">
                  <IcoX />
                </button>
              </span>
            ))}
            {hashtags.length < MAX_HASHTAGS && (
              <input
                value={hashtagDraft}
                onChange={(e) => setHashtagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    addHashtag();
                  }
                }}
                onBlur={addHashtag}
                placeholder="Añadir hashtag…"
                className="min-w-[120px] flex-1 rounded-full border border-white/10 bg-white/3 px-3 py-1 text-xs text-white/70 placeholder:text-white/25 outline-none focus:border-sky-400/40"
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-white/6 pt-4">
          <input
            type="date"
            value={date}
            min={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-28 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
          />
        </div>

        <button
          type="button"
          onClick={() => void approveAndSchedule()}
          disabled={saving || uploadingImage || !text.trim()}
          className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 py-2.5 text-sm font-black text-white shadow-md shadow-sky-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Programando…" : "Aprobar y programar"}
        </button>
      </div>
    </div>
  );
}
