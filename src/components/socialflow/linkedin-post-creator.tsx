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
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [publishedNow, setPublishedNow] = useState(false);

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

  async function publishNow() {
    if (!text.trim()) {
      setError("Escribe o genera un texto antes de publicar.");
      return;
    }
    setError(null);
    setPublishing(true);
    try {
      const title = text.split("\n")[0]?.slice(0, 72).trim() || "Post de LinkedIn";
      const bodyWithHashtags = hashtags.length ? `${text}\n\n${hashtags.join(" ")}` : text;

      // 1. Crear el post con status SCHEDULED (para este instante)
      const createRes = await fetch("/api/socialflow/posts", {
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
          scheduledAt: new Date().toISOString(),
        }),
      });
      const createData = (await createRes.json()) as { post?: { id: string }; code?: string; message?: string };
      if (!createRes.ok || !createData.post) {
        throw new Error(createData.message ?? createData.code ?? "Error al crear el post.");
      }

      // 2. Publicar inmediatamente
      const postId = createData.post.id;
      const publishRes = await fetch(`/api/socialflow/posts/${postId}/publish`, { method: "POST" });
      const publishData = (await publishRes.json()) as { ok?: boolean; code?: string; message?: string };
      if (!publishRes.ok || publishData.ok === false) {
        throw new Error(publishData.message ?? publishData.code ?? "Error al publicar en LinkedIn.");
      }

      setPublishedNow(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al publicar.");
    } finally {
      setPublishing(false);
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

  function resetForm() {
    setText("");
    setHashtags([]);
    removeImage();
    setSavedAt(null);
    setPublishedNow(false);
  }

  if (publishedNow) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
          <IcoLinkedIn />
        </div>
        <p className="text-lg font-bold text-gray-900">¡Post publicado en LinkedIn!</p>
        <p className="mt-1 text-sm text-gray-500">Tu post ya está visible en tu perfil.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={resetForm} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50">
            Crear otro post
          </button>
          <button type="button" onClick={() => router.push("/socialflow/plan")} className="rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/20 transition hover:brightness-110">
            Ver publicaciones
          </button>
        </div>
      </div>
    );
  }

  if (savedAt) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
          <IcoLinkedIn />
        </div>
        <p className="text-lg font-bold text-gray-900">Post de LinkedIn programado</p>
        <p className="mt-1 text-sm text-gray-500">
          Se publicará el {new Date(savedAt).toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" })}.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button type="button" onClick={resetForm} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50">
            Crear otro post
          </button>
          <button type="button" onClick={() => router.push("/socialflow/plan")} className="rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/20 transition hover:brightness-110">
            Ver próximas publicaciones
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
          <IcoLinkedIn />
        </div>
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">Socialcors · LinkedIn</div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900">Crear Post para LinkedIn</h1>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500">Texto del post</p>
            <span className={`text-[11px] ${text.length > MAX_CHARS ? "text-red-600" : "text-gray-400"}`}>
              {text.length}/{MAX_CHARS}
            </span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
            rows={3}
            placeholder="¿Qué quieres compartir con tu red profesional?"
            className="w-full resize-y rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-sky-400"
          />
        </div>

        <button
          type="button"
          onClick={() => void generateWithAi()}
          disabled={generating || uploadingImage}
          className="flex items-center gap-2 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IcoSparkles />
          {generating ? "Generando…" : "Generar con IA"}
        </button>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-gray-500">Imagen (opcional)</p>
          {imagePreviewUrl ? (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreviewUrl} alt="" className="h-32 w-32 rounded-xl object-cover" />
              {uploadingImage && (
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/50 text-xs text-white/90">
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
              className="flex items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-500 transition hover:border-sky-400 hover:text-gray-700"
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
          <p className="mb-1.5 text-xs font-semibold text-gray-500">
            Hashtags ({hashtags.length}/{MAX_HASHTAGS})
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {hashtags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700"
              >
                {tag}
                <button type="button" onClick={() => removeHashtag(tag)} className="text-sky-700/60 hover:text-sky-900">
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
                className="min-w-[120px] flex-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-gray-700 placeholder:text-gray-400 outline-none focus:border-sky-400"
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4">
          <input
            type="date"
            value={date}
            min={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-28 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-sky-500/50"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void publishNow()}
            disabled={publishing || saving || uploadingImage || !text.trim()}
            className="flex-1 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] py-2.5 text-sm font-black text-white shadow-md shadow-[#3b82f6]/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {publishing ? "Publicando…" : "⚡ Publicar ahora"}
          </button>
          <button
            type="button"
            onClick={() => void approveAndSchedule()}
            disabled={saving || publishing || uploadingImage || !text.trim()}
            className="flex-1 rounded-xl border border-sky-300 bg-sky-50 py-2.5 text-sm font-black text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Programando…" : "Programar para después"}
          </button>
        </div>
      </div>
    </div>
  );
}
