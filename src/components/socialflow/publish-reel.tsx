"use client";

import { useRef, useState } from "react";
import ReelsCreator from "./reels-creator";

type Phase = "idle" | "uploading" | "creating" | "error";

function IcoUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-10 w-10">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-6 w-6 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// Wraps ReelsCreator (Ken Burns MP4 + caption + publish) behind a single-image
// dropzone — everything past the upload is delegated to ReelsCreator untouched.
export default function PublishReel({ saasId }: { saasId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  function reset() {
    setPhase("idle");
    setError(null);
    setImageUrl(null);
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
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/socialflow/media/upload", { method: "POST", body: form });
      const uploadData = (await uploadRes.json()) as { url?: string; message?: string; error?: string };
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.message ?? uploadData.error ?? "Error al subir la imagen.");
      }
      setImageUrl(uploadData.url);
      setPhase("creating");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado.");
      setPhase("error");
    }
  }

  if (phase === "creating" && imageUrl) {
    return <ReelsCreator imageUrl={imageUrl} saasId={saasId} onClose={reset} />;
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
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
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
            {phase === "uploading" ? "Subiendo imagen…" : "Arrastra tu foto aquí"}
          </p>
          {phase !== "uploading" && (
            <>
              <p className="mt-1 text-sm text-white/40">o haz click para seleccionar</p>
              <p className="mt-3 text-xs text-white/25">1 foto · JPEG, PNG, WebP, GIF · máx. 200 MB</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
