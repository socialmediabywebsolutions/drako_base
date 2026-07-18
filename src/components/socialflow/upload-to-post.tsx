"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ImageAnalysis } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";
import ReelsCreator from "./reels-creator";

type ContentCategory = "foto_real" | "grafico_texto";

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemStep = "uploading" | "analyzing" | "ready" | "saving" | "saved" | "error";

type UploadItem = {
  id: string;
  file: File;
  localPreviewUrl: string;   // blob URL — used for all <img> display
  r2Url: string | null;      // R2 public URL — only used as imageHint in DB
  r2Key: string | null;      // R2 object key — used by server to read via binding
  step: ItemStep;
  error: string | null;
  imageAnalysis: ImageAnalysis | null;
  contentCategory: ContentCategory | null;
  editBody: string;
  editHashtags: string[];
  editDate: string;          // YYYY-MM-DD
  editTime: string;          // HH:MM
  editContentType: string;
  editProvider: string;
  isEditing: boolean;
  savedAt: string | null;    // ISO scheduledAt after successful save
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function toIsoString(date: string, time: string): string {
  return `${date}T${time || "09:00"}:00.000Z`;
}

function parseDate(iso: string): string {
  return iso.slice(0, 10);
}

function parseTime(iso: string): string {
  return iso.slice(11, 16);
}

function displayDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const CONTENT_TYPE_LABELS: Record<string, string> = { FEED: "Feed", REEL: "Reel", STORY: "Story" };
const PROVIDER_LABELS: Record<string, string> = { INSTAGRAM: "Instagram", LINKEDIN: "LinkedIn" };

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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
    </svg>
  );
}

function IcoCheck({ sm }: { sm?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={sm ? "h-3.5 w-3.5" : "h-4 w-4"}>
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

function IcoX() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function IcoPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function IcoCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}

function IcoFilm() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-3.5 w-3.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h16.5v15H3.75v-15Zm0 4.5h16.5m-16.5 6h16.5M8.25 4.5v15m7.5-15v15" />
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

function Spinner({ sm }: { sm?: boolean }) {
  return (
    <svg
      className={`animate-spin text-violet-400 ${sm ? "h-4 w-4" : "h-5 w-5"}`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Item card ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onApprove,
  onPreview,
  onRemove,
  onUpdate,
  onCreateReel,
}: {
  item: UploadItem;
  onApprove: (id: string) => void;
  onPreview: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<UploadItem>) => void;
  onCreateReel: (id: string) => void;
}) {
  // ── uploading ──────────────────────────────────────────────────────────────
  if (item.step === "uploading") {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/3">
        <div className="flex h-40 items-center justify-center bg-white/4">
          <Spinner />
        </div>
        <div className="px-4 py-3">
          <p className="text-sm font-medium text-white/50">Subiendo imagen…</p>
          <p className="mt-0.5 truncate text-xs text-white/25">{item.file.name}</p>
        </div>
      </div>
    );
  }

  // ── analyzing ──────────────────────────────────────────────────────────────
  if (item.step === "analyzing") {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/3">
        <div className="relative h-40 overflow-hidden bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.localPreviewUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Spinner />
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm font-medium text-white/50">Analizando con IA…</p>
          <p className="mt-0.5 text-xs text-white/25">LLaVA · Mistral</p>
        </div>
      </div>
    );
  }

  // ── error ──────────────────────────────────────────────────────────────────
  if (item.step === "error") {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border border-rose-500/20 bg-rose-500/5">
        <div className="relative h-40 overflow-hidden bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.localPreviewUrl} alt="" className="h-full w-full object-cover opacity-40" />
        </div>
        <div className="flex flex-col gap-3 px-4 py-3">
          <p className="text-xs leading-relaxed text-rose-300">{item.error}</p>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="flex items-center gap-1.5 self-start rounded-lg border border-rose-500/25 px-3 py-1.5 text-xs text-rose-400 transition hover:bg-rose-500/10"
          >
            <IcoX /> Eliminar
          </button>
        </div>
      </div>
    );
  }

  // ── saved ──────────────────────────────────────────────────────────────────
  if (item.step === "saved") {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
        <div className="relative h-40 overflow-hidden bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.localPreviewUrl} alt="" className="h-full w-full object-cover opacity-60" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
              <IcoCheck />
            </div>
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm font-semibold text-emerald-300">Programado</p>
          {item.savedAt && (
            <p className="mt-0.5 text-xs text-white/35">
              {displayDate(item.savedAt)} · {item.savedAt.slice(11, 16)} UTC
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── saving ─────────────────────────────────────────────────────────────────
  if (item.step === "saving") {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/3">
        <div className="relative h-40 overflow-hidden bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.localPreviewUrl} alt="" className="h-full w-full object-cover opacity-50" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Spinner />
          </div>
        </div>
        <div className="px-4 py-3">
          <p className="text-sm font-medium text-white/50">Programando…</p>
        </div>
      </div>
    );
  }

  // ── ready (compact view) ───────────────────────────────────────────────────
  if (!item.isEditing) {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-white/3">
        {/* Thumbnail — click opens preview modal */}
        <button
          type="button"
          onClick={() => onPreview(item.id)}
          className="group relative h-40 w-full overflow-hidden bg-black/20 focus:outline-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.localPreviewUrl} alt="" className="h-full w-full object-cover" />
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm">
            <IcoSparkles />
            <span className="text-[10px] font-semibold text-white/70">IA</span>
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/35">
            <span className="rounded-full bg-black/55 px-3 py-1 text-[11px] font-bold text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">Ver preview</span>
          </div>
        </button>

        {/* Content — also opens preview when clicked outside the action buttons */}
        <div
          className="flex flex-1 cursor-pointer flex-col gap-3 p-4"
          onClick={() => onPreview(item.id)}
        >
          {item.error && (
            <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{item.error}</p>
          )}

          <p className="line-clamp-3 text-sm leading-relaxed text-white/70">{item.editBody}</p>

          <div className="flex flex-wrap gap-1.5">
            {item.editHashtags.length > 0 && (
              <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-medium text-violet-300">
                {item.editHashtags.length} hashtags
              </span>
            )}
            <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-medium text-white/40">
              {PROVIDER_LABELS[item.editProvider] ?? item.editProvider}
            </span>
            <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-medium text-white/40">
              {CONTENT_TYPE_LABELS[item.editContentType] ?? item.editContentType}
            </span>
          </div>

          {item.editDate && (
            <p className="flex items-center gap-1.5 text-xs text-white/35">
              <IcoCalendar />
              {displayDate(item.editDate)} · {item.editTime || "09:00"} UTC
            </p>
          )}

          {/* Actions */}
          <div className="mt-auto flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/35 transition hover:border-rose-500/30 hover:text-rose-400"
            >
              <IcoX />
            </button>
            <button
              type="button"
              onClick={() => onUpdate(item.id, { isEditing: true })}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/45 transition hover:bg-white/5 hover:text-white/70"
            >
              <IcoPencil /> Editar
            </button>
            <button
              type="button"
              onClick={() => onCreateReel(item.id)}
              className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 px-3 py-1.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-500/10"
            >
              <IcoFilm /> Reel
            </button>
            <button
              type="button"
              onClick={() => onPreview(item.id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
            >
              <IcoCheck sm /> Aprobar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ready (edit view) ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-violet-500/20 bg-white/3">
      {/* Thumbnail small */}
      <div className="relative h-24 overflow-hidden bg-black/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.localPreviewUrl} alt="" className="h-full w-full object-cover opacity-70" />
        <button
          type="button"
          onClick={() => onUpdate(item.id, { isEditing: false })}
          className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white/60 backdrop-blur-sm transition hover:bg-white/20"
        >
          <IcoX /> Cerrar
        </button>
      </div>

      {/* Edit form */}
      <div className="flex flex-col gap-3 p-4">
        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/25">Caption</p>
          <textarea
            value={item.editBody}
            onChange={(e) => onUpdate(item.id, { editBody: e.target.value })}
            rows={5}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm leading-relaxed text-white/80 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
        </div>

        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/25">
            Hashtags ({item.editHashtags.length}/15)
          </p>
          <textarea
            value={item.editHashtags.join(" ")}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (!raw) { onUpdate(item.id, { editHashtags: [] }); return; }
              const tags = raw.split(/\s+/).map((t) => t.startsWith("#") ? t : `#${t}`).slice(0, 15);
              onUpdate(item.id, { editHashtags: tags });
            }}
            rows={2}
            placeholder="#hashtag1 #hashtag2 …"
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={item.editDate}
            min={todayStr()}
            onChange={(e) => onUpdate(item.id, { editDate: e.target.value })}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
          <input
            type="time"
            value={item.editTime}
            onChange={(e) => onUpdate(item.id, { editTime: e.target.value })}
            className="w-28 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
          <select
            value={item.editProvider}
            onChange={(e) => onUpdate(item.id, { editProvider: e.target.value })}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          >
            <option value="INSTAGRAM">Instagram</option>
            <option value="LINKEDIN">LinkedIn</option>
          </select>
          <select
            value={item.editContentType}
            onChange={(e) => onUpdate(item.id, { editContentType: e.target.value })}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          >
            <option value="FEED">Feed</option>
            <option value="REEL">Reel</option>
            <option value="STORY">Story</option>
          </select>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => onUpdate(item.id, { isEditing: false })}
            className="flex-1 rounded-lg border border-white/10 py-2 text-xs text-white/40 transition hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => { onUpdate(item.id, { isEditing: false }); onPreview(item.id); }}
            disabled={!item.editDate || !item.editBody.trim()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <IcoCheck sm /> Aprobar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk preview modal ────────────────────────────────────────────────────────

function BulkPreviewModal({
  items,
  onConfirmAll,
  onClose,
  onPreviewOne,
}: {
  items: UploadItem[];
  onConfirmAll: () => void;
  onClose: () => void;
  onPreviewOne: (id: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: "rgba(0,0,0,0.70)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d1e] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-violet-400">Confirmación</p>
            <h3 className="text-lg font-black text-white">Programar {items.length} posts</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
          >
            <IcoX />
          </button>
        </div>

        {/* Thumbnails grid */}
        <div className="overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onPreviewOne(item.id)}
                className="group flex flex-col overflow-hidden rounded-xl border border-white/8 bg-white/3 text-left transition hover:border-violet-500/40 hover:bg-white/6"
              >
                <div className="relative aspect-square w-full overflow-hidden bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.localPreviewUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                    <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100">Ver</span>
                  </div>
                </div>
                <div className="px-2 py-1.5">
                  <p className="text-[10px] font-semibold text-white/60">
                    {item.editDate ? displayDate(item.editDate) : "—"}
                  </p>
                  <p className="text-[10px] text-white/35">{item.editTime || "09:00"} UTC</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-white/8 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/45 transition hover:bg-white/5 hover:text-white/70"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmAll}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
          >
            <IcoCheck /> Confirmar todos ({items.length})
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Preview modal ─────────────────────────────────────────────────────────────

function PreviewModal({
  item,
  onConfirm,
  onClose,
}: {
  item: UploadItem;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0d0d1e] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
        >
          <IcoX />
        </button>

        <div className="flex flex-col overflow-y-auto sm:flex-row">
          {/* Image */}
          <div className="flex h-56 shrink-0 items-center justify-center overflow-hidden bg-black/40 sm:h-auto sm:w-64">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.localPreviewUrl} alt="" className="h-full w-full object-contain" />
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
            {/* Meta pills */}
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-violet-300">
                {PROVIDER_LABELS[item.editProvider] ?? item.editProvider}
              </span>
              <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-medium text-white/50">
                {CONTENT_TYPE_LABELS[item.editContentType] ?? item.editContentType}
              </span>
              {item.editDate && (
                <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-medium text-white/50">
                  {displayDate(item.editDate)} · {item.editTime || "09:00"} UTC
                </span>
              )}
            </div>

            {/* Caption completo */}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">
              {item.editBody}
            </p>

            {/* Hashtags */}
            {item.editHashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.editHashtags.map((h) => (
                  <span key={h} className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] text-violet-300">
                    {h}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-white/8 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/45 transition hover:bg-white/5 hover:text-white/70"
          >
            Volver a editar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
          >
            <IcoCheck /> Confirmar y programar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function UploadToPost({
  saasId,
  maxImages = 8,
  contentType,
}: {
  saasId: string;
  maxImages?: number;
  contentType?: "AUTO" | "FEED" | "REEL" | "STORY";
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [bulkPreviewOpen, setBulkPreviewOpen] = useState(false);
  const [reelsItemId, setReelsItemId] = useState<string | null>(null);

  const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const savedCount = items.filter((i) => i.step === "saved").length;
  const readyCount = items.filter((i) => i.step === "ready").length;
  const allDone =
    items.length > 0 && items.every((i) => i.step === "saved" || i.step === "error");
  const allSaved = items.length > 0 && items.every((i) => i.step === "saved");
  const activeCount = items.filter((i) => i.step !== "error").length;
  const canAddMore = activeCount < maxImages;

  // Redirect when all successfully saved
  useEffect(() => {
    if (!allSaved) return;
    const t = setTimeout(() => router.push("/socialflow/plan"), 2500);
    return () => clearTimeout(t);
  }, [allSaved, router]);

  // Phase 1: upload to R2 + classify the photo (LLaVA) — no caption/schedule yet.
  // Returns null (and marks the item as errored) if upload or analysis fails.
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
        editContentType: "FEED", editProvider: "INSTAGRAM",
        isEditing: false, savedAt: null,
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

      setItems((prev) =>
        prev.map((i) =>
          i.id === id ? { ...i, r2Url: uploadData.url!, r2Key: uploadData.key!, step: "analyzing" } : i
        )
      );

      const analyzeRes = await fetch("/api/socialflow/posts/generate-from-image", {
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

      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, imageAnalysis: analyzeData.imageAnalysis!, contentCategory: analyzeData.contentCategory! }
            : i
        )
      );

      return {
        id,
        r2Url: uploadData.url,
        r2Key: uploadData.key,
        imageAnalysis: analyzeData.imageAnalysis,
        contentCategory: analyzeData.contentCategory,
        batchIndex,
      };
    } catch (e) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, step: "error", error: e instanceof Error ? e.message : "Error inesperado." }
            : i
        )
      );
      return null;
    }
  }

  // Phase 2: generate caption + hashtags + calendar slot for an already-analyzed photo.
  // scheduleIndex drives the day assignment (post-interleaving); batchIndex (original
  // upload order) still drives opener rotation, untouched by the reordering.
  async function finalizeFile(
    item: { id: string; r2Url: string; r2Key: string; imageAnalysis: ImageAnalysis; batchIndex: number },
    scheduleIndex: number,
  ): Promise<void> {
    try {
      const genRes = await fetch("/api/socialflow/posts/generate-from-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: item.r2Url,
          imageKey: item.r2Key,
          saasId,
          imageAnalysis: item.imageAnalysis,
          batchIndex: item.batchIndex,
          scheduleIndex,
          ...(contentType && contentType !== "AUTO" ? { forcedContentType: contentType } : {}),
        }),
      });
      const genData = (await genRes.json()) as {
        suggestedPost?: {
          body: string; hashtags: string[]; scheduledAt: string;
          contentType: string; provider: string;
        };
        code?: string; message?: string;
      };
      if (!genRes.ok || !genData.suggestedPost) {
        throw new Error(genData.message ?? genData.code ?? "Error al generar el post.");
      }

      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? {
                ...i,
                step: "ready",
                editBody: genData.suggestedPost!.body,
                editHashtags: genData.suggestedPost!.hashtags,
                editDate: parseDate(genData.suggestedPost!.scheduledAt),
                editTime: parseTime(genData.suggestedPost!.scheduledAt),
                editContentType: genData.suggestedPost!.contentType,
                editProvider: genData.suggestedPost!.provider,
              }
            : i
        )
      );
    } catch (e) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, step: "error", error: e instanceof Error ? e.message : "Error inesperado." }
            : i
        )
      );
    }
  }

  // Interleave two ordered groups (foto_real / grafico_texto) so the calendar alternates
  // content types regardless of the order the files were selected in. If one group runs
  // out, the remainder of the other is appended in its original order — a single-type
  // batch is therefore untouched (identity order, same result as before this change).
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

    // Phase 1: upload + classify every photo of this wave in parallel (unaffected by
    // the reordering below — each photo still uploads/analyzes as soon as it can).
    const analyzed = await Promise.all(toProcess.map((f, i) => analyzeFile(f, startingIndex + i)));
    const succeeded = analyzed.filter((r): r is NonNullable<typeof r> => r !== null);

    // Phase 2: reorder this wave by content type, then assign calendar slots + generate
    // captions in that interleaved order (still one request per photo, run in parallel).
    const interleaved = interleaveByCategory(succeeded);
    await Promise.all(interleaved.map((item, position) => finalizeFile(item, startingIndex + position)));
  }

  async function approveItem(id: string): Promise<void> {
    const item = items.find((i) => i.id === id);
    if (!item || item.step !== "ready" || !item.r2Url) return;

    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, step: "saving" } : i)));

    try {
      const title =
        item.editBody.split("\n")[0]?.replace(/^#+\s*/, "").slice(0, 72).trim() ?? "Post";
      const bodyWithHashtags = item.editHashtags.length
        ? `${item.editBody}\n\n${item.editHashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}`
        : item.editBody;
      const scheduledAt = toIsoString(item.editDate, item.editTime);

      const res = await fetch("/api/socialflow/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
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

      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, step: "saved", savedAt: scheduledAt } : i))
      );
    } catch (e) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, step: "ready", error: e instanceof Error ? e.message : "Error al guardar." }
            : i
        )
      );
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

  function handleReset() {
    items.forEach((i) => URL.revokeObjectURL(i.localPreviewUrl));
    setItems([]);
    setGlobalError(null);
  }

  // ── All saved screen ────────────────────────────────────────────────────────

  if (allSaved && items.length > 0) {
    return (
      <div className="flex flex-col items-center gap-6 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
          <IcoCheck />
        </div>
        <div className="text-center">
          <p className="text-xl font-black text-emerald-300">
            {items.length === 1 ? "Post programado" : `${items.length} posts programados`}
          </p>
          <p className="mt-1 text-sm text-white/40">Redirigiendo al calendario…</p>
        </div>
        <div className="w-full max-w-sm space-y-2 px-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl bg-white/6 px-3 py-2.5"
            >
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.localPreviewUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <p className="flex-1 truncate text-xs text-white/50">{item.editBody.slice(0, 50)}…</p>
              {item.savedAt && (
                <span className="shrink-0 text-xs font-semibold text-emerald-400">
                  {displayDate(item.savedAt)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Empty: drop zone ────────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        {globalError && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {globalError}
          </div>
        )}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            void handleFiles(e.dataTransfer.files);
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
            <p className="text-base font-bold text-white/80">Arrastra tus fotos aquí</p>
            <p className="mt-1 text-sm text-white/40">o haz click para seleccionar</p>
            <p className="mt-3 text-xs text-white/25">Hasta {maxImages} fotos · JPEG, PNG, WebP, GIF · máx. 200 MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); }}
          />
        </div>

        <div className="rounded-2xl border border-white/6 bg-white/3 px-5 py-4">
          <p className="mb-2 text-xs font-black uppercase tracking-widest text-white/25">Cómo funciona</p>
          <ol className="space-y-2">
            {[
              "Sube hasta 8 fotos de tu trabajo, producto, equipo o espacio.",
              "La IA analiza cada imagen y entiende el contexto visual.",
              "Genera un caption optimizado, hashtags y fecha/hora para cada una.",
              "Aprueba todas de un click o edita individualmente antes de programar.",
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/45">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-black text-violet-400">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  // ── Items grid ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {globalError && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {globalError}
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-white/40">
          {activeCount} foto{activeCount !== 1 ? "s" : ""}
          {savedCount > 0 && (
            <span className="ml-2 text-emerald-400">
              · {savedCount} programada{savedCount !== 1 ? "s" : ""}
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          {canAddMore && (
            <button
              type="button"
              onClick={() => addMoreRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/4 px-3 py-2 text-xs text-white/50 transition hover:bg-white/8 hover:text-white/70"
            >
              <IcoPlus />
              Añadir fotos ({activeCount}/{maxImages})
            </button>
          )}
          {readyCount >= 2 && (
            <button
              type="button"
              onClick={() => setBulkPreviewOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
            >
              <IcoCheck sm />
              Aprobar todo ({readyCount})
            </button>
          )}
          {allDone && savedCount > 0 && (
            <button
              type="button"
              onClick={() => router.push("/socialflow/plan")}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/15"
            >
              <IcoCalendar />
              Ver en calendario
            </button>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/4 px-3 py-2 text-xs text-white/35 transition hover:bg-white/8"
          >
            <IcoReset />
          </button>
        </div>
      </div>

      <input
        ref={addMoreRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); }}
      />

      {/* Bulk preview modal (z-40) */}
      {bulkPreviewOpen && (
        <BulkPreviewModal
          items={items.filter((i) => i.step === "ready")}
          onConfirmAll={() => { setBulkPreviewOpen(false); void approveAll(); }}
          onClose={() => setBulkPreviewOpen(false)}
          onPreviewOne={(id) => setPreviewId(id)}
        />
      )}

      {/* Individual preview modal (z-50, overlays bulk modal) */}
      {previewId && (() => {
        const previewItem = items.find((i) => i.id === previewId);
        return previewItem ? (
          <PreviewModal
            item={previewItem}
            onConfirm={() => { setPreviewId(null); void approveItem(previewId); }}
            onClose={() => setPreviewId(null)}
          />
        ) : null;
      })()}

      {/* Reels creator modal (z-50, mismo nivel que el preview individual) */}
      {reelsItemId && (() => {
        const reelsItem = items.find((i) => i.id === reelsItemId);
        if (!reelsItem?.r2Url || !reelsItem.r2Key) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.75)" }}
            onClick={() => setReelsItemId(null)}
          >
            <div
              className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-3xl border border-white/10 bg-[#0d0d1e] p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-violet-400">Crear Reel</h3>
                <button
                  type="button"
                  onClick={() => setReelsItemId(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
                >
                  <IcoX />
                </button>
              </div>
              <ReelsCreator
                imageUrl={reelsItem.r2Url}
                imageKey={reelsItem.r2Key}
                saasId={saasId}
                onClose={() => setReelsItemId(null)}
              />
            </div>
          </div>
        );
      })()}

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            onApprove={approveItem}
            onPreview={setPreviewId}
            onCreateReel={setReelsItemId}
            onRemove={removeItem}
            onUpdate={updateItem}
          />
        ))}

        {/* Mini drop zone to add more */}
        {canAddMore && items.length > 0 && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              void handleFiles(e.dataTransfer.files);
            }}
            onClick={() => addMoreRef.current?.click()}
            className={[
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-all",
              isDragging
                ? "border-violet-500/50 bg-violet-500/8"
                : "border-white/10 hover:border-violet-500/30 hover:bg-white/3",
            ].join(" ")}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/6 text-white/30">
              <IcoPlus />
            </div>
            <p className="text-xs text-white/30">Añadir más fotos</p>
            <p className="text-[10px] text-white/20">{maxImages - activeCount} disponible{maxImages - activeCount !== 1 ? "s" : ""}</p>
          </div>
        )}
      </div>
    </div>
  );
}
