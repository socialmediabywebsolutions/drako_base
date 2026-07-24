"use client";

import { useRef } from "react";
import { useCampaignPhotoBatch, PhotoBatchGrid } from "./campaign-photo-batch";

// Campaign-scoped sibling of UploadToPost (src/components/socialflow/upload-to-post.tsx) —
// intentionally a separate component: it talks to /api/socialflow/campaigns/[id]/photos
// (campaign-aware narrative + bounded scheduling) instead of the individual-photo endpoint,
// and always sends campaignId when persisting the post.
//
// Wrapper delgado sobre useCampaignPhotoBatch en modo autoProcess: true — mismo comportamiento
// de siempre (analiza y agenda cada foto en cuanto se sube). El modo diferido (subir primero,
// confirmar después) vive en el wizard de creación de campaña (campaigns-board.tsx).

export default function CampaignPhotoUpload({
  campaignId,
  saasId,
  maxImages = 8,
}: {
  campaignId: string;
  saasId: string;
  maxImages?: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    items, globalError, activeCount, readyCount, savedCount,
    addFiles, approveAll, approveItem, removeItem, editBody, editContentType,
  } = useCampaignPhotoBatch({ campaignId, saasId, maxImages, autoProcess: true });

  return (
    <div className="space-y-4 p-4">
      {globalError && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">{globalError}</div>
      )}

      <div
        onClick={() => fileInputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/12 bg-white/3 p-8 text-center transition hover:border-violet-500/40 hover:bg-violet-500/5"
      >
        <p className="text-sm font-semibold text-white/70">Arrastra o haz click para subir fotos de esta campaña</p>
        <p className="text-xs text-white/30">Hasta {maxImages} fotos · JPEG, PNG, WebP, GIF</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files) void addFiles(e.target.files); }}
        />
      </div>

      {items.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-white/40">
              {activeCount} foto{activeCount !== 1 ? "s" : ""}
              {savedCount > 0 && (
                <span className="ml-2 text-emerald-400">· {savedCount} programada{savedCount !== 1 ? "s" : ""}</span>
              )}
            </p>
            {readyCount >= 1 && (
              <button
                type="button"
                onClick={() => void approveAll()}
                className="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
              >
                Aprobar todo ({readyCount})
              </button>
            )}
          </div>

          <PhotoBatchGrid items={items} onRemove={removeItem} onApprove={approveItem} onEditBody={editBody} onEditContentType={editContentType} />
        </>
      )}
    </div>
  );
}
