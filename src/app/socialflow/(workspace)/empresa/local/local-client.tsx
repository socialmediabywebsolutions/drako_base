"use client";

import { useRef, useState } from "react";
import type { EmpresaLocal, EmpresaLocalPhoto, LocalPhotoType } from "@/lib/socialflow/local/types";

type PhotoDTO = Omit<EmpresaLocalPhoto, "tenantId" | "saasId">;
type LocalDTO = Omit<EmpresaLocal, "tenantId" | "saasId">;

const PHOTO_TYPE_LABEL: Record<LocalPhotoType, string> = {
  exterior: "Exterior",
  interior: "Interior",
  ambiente: "Ambiente",
};

export default function LocalClient({
  initialLocal,
  initialPhotos,
}: {
  initialLocal: EmpresaLocal | null;
  initialPhotos: EmpresaLocalPhoto[];
}) {
  const [businessName, setBusinessName] = useState(initialLocal?.businessName ?? "");
  const [address, setAddress] = useState(initialLocal?.address ?? "");
  const [openingHours, setOpeningHours] = useState(initialLocal?.openingHours ?? "");
  const [description, setDescription] = useState(initialLocal?.description ?? "");
  const [niche, setNiche] = useState(initialLocal?.niche ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [photos, setPhotos] = useState<PhotoDTO[]>(initialPhotos);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/socialflow/empresa/local", {
        method: initialLocal ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          address: address.trim(),
          openingHours: openingHours.trim(),
          description: description.trim(),
          niche: niche.trim(),
        }),
      });
      const json = (await res.json()) as { ok: true; local: LocalDTO } | { ok: false; error?: string };
      if (json.ok) setSaved(true);
      else setSaveError(json.error ?? "Error al guardar");
    } catch {
      setSaveError("Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  function handlePhotoUploaded(photo: PhotoDTO) {
    setPhotos((prev) => [photo, ...prev]);
  }

  async function handleDeletePhoto(id: string) {
    if (!confirm("¿Eliminar esta foto?")) return;
    try {
      const res = await fetch(`/api/socialflow/empresa/local/photos/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { ok: true } | { ok: false; error?: string };
      if (json.ok) setPhotos((prev) => prev.filter((p) => p.id !== id));
      else setUploadError(json.error ?? "Error al eliminar");
    } catch {
      setUploadError("Error inesperado");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">
          Socialcors · Mi Local
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Mi Local</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
          Cuéntale a la IA cómo es tu negocio y sube fotos de tu local para que el contenido encaje con tu identidad visual.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
        <h3 className="mb-4 text-sm font-semibold text-white">Información del negocio</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Nombre del negocio">
            <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Peluquería Bella Vista" className={inputCls} />
          </Field>
          <Field label="Dirección">
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle Mayor 12, Madrid" className={inputCls} />
          </Field>
          <Field label="Nicho / categoría">
            <input type="text" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Peluquería, restaurante, clínica..." className={inputCls} />
          </Field>
          <Field label="Horarios de apertura">
            <textarea value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} placeholder="Lunes a viernes 9:00-20:00, sábados 10:00-14:00" rows={2} className={inputCls} />
          </Field>
          <Field label="Descripción del negocio">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué hace tu negocio, cómo lo hace, su estilo..." rows={4} className={inputCls} />
          </Field>

          {saveError && <p className="text-sm text-red-400">{saveError}</p>}
          {saved && <p className="text-sm text-emerald-400">Guardado.</p>}

          <button type="submit" disabled={saving} className="inline-flex rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
      </div>

      {uploadError && (
        <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-300">{uploadError}</p>
      )}

      <div className="space-y-5">
        {(["exterior", "interior", "ambiente"] as LocalPhotoType[]).map((type) => (
          <PhotoCategorySection
            key={type}
            type={type}
            photos={photos.filter((p) => p.photoType === type)}
            onUploaded={handlePhotoUploaded}
            onDelete={handleDeletePhoto}
            onError={setUploadError}
          />
        ))}
      </div>
    </div>
  );
}

function PhotoCategorySection({
  type, photos, onUploaded, onDelete, onError,
}: {
  type: LocalPhotoType;
  photos: PhotoDTO[];
  onUploaded: (photo: PhotoDTO) => void;
  onDelete: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    onError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("photoType", type);
      const res = await fetch("/api/socialflow/empresa/local/photos", { method: "POST", body: fd });
      const json = (await res.json()) as { ok: true; photo: PhotoDTO } | { ok: false; error?: string; message?: string };
      if (json.ok) onUploaded(json.photo);
      else onError(json.message ?? json.error ?? "Error al subir la foto");
    } catch {
      onError("Error inesperado");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/4 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">
          {PHOTO_TYPE_LABEL[type]} <span className="ml-1.5 text-xs font-normal text-white/30">({photos.length})</span>
        </h3>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/60 transition hover:border-violet-500/40 hover:text-white disabled:opacity-50"
        >
          {uploading ? "Subiendo..." : "+ Añadir foto"}
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" className="hidden" onChange={handleFile} />
      </div>

      {photos.length === 0 ? (
        <p className="mt-4 text-sm text-white/30">Sin fotos de {PHOTO_TYPE_LABEL[type].toLowerCase()} todavía.</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.photoUrl} alt={PHOTO_TYPE_LABEL[type]} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onDelete(photo.id)}
                className="absolute right-1.5 top-1.5 rounded-lg bg-black/60 px-2 py-1 text-[11px] font-medium text-white/70 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/80 hover:text-white"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20 transition backdrop-blur-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-white/45">{label}</label>
      {children}
    </div>
  );
}
