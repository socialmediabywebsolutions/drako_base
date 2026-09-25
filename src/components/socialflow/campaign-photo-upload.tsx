"use client";

import { useRef, useState } from "react";
import { useCampaignPhotoBatch, PhotoBatchGrid } from "./campaign-photo-batch";
import ReelsCreator from "./reels-creator";

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
  const [reelsPhotoId, setReelsPhotoId] = useState<string | null>(null);
  const {
    items, globalError, activeCount, approvableCount, savedCount, skippedReelsCount,
    addFiles, approveAll, approveItem, removeItem, editBody, editContentType,
    markReelReady, clearSkippedReels,
  } = useCampaignPhotoBatch({ campaignId, saasId, maxImages, autoProcess: true });

  return (
    <div className="space-y-4 p-4">
      {globalError && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">{globalError}</div>
      )}

      <div
        onClick={() => fileInputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center transition hover:border-blue-400 hover:bg-blue-50"
      >
        <p className="text-sm font-semibold text-gray-600">Arrastra o haz click para subir fotos de esta campaña</p>
        <p className="text-xs text-gray-400">Hasta {maxImages} fotos · JPEG, PNG, WebP, GIF</p>
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
            <p className="text-xs text-gray-400">
              {activeCount} foto{activeCount !== 1 ? "s" : ""}
              {savedCount > 0 && (
                <span className="ml-2 text-emerald-600">· {savedCount} programada{savedCount !== 1 ? "s" : ""}</span>
              )}
            </p>
            {approvableCount >= 1 && (
              <button
                type="button"
                onClick={() => void approveAll()}
                className="rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-3 py-1.5 text-xs font-bold text-white shadow-md transition hover:from-blue-600 hover:to-cyan-600"
              >
                Aprobar todo ({approvableCount})
              </button>
            )}
          </div>

          {skippedReelsCount > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <span>
                {skippedReelsCount} Reel{skippedReelsCount !== 1 ? "s" : ""} pendiente{skippedReelsCount !== 1 ? "s" : ""} — genera y revisa cada uno con ▶ Ver Reel
              </span>
              <button
                type="button"
                onClick={clearSkippedReels}
                className="text-blue-400 transition hover:text-blue-600"
              >
                ✕
              </button>
            </div>
          )}

          <PhotoBatchGrid
            items={items}
            onRemove={removeItem}
            onApprove={approveItem}
            onEditBody={editBody}
            onEditContentType={editContentType}
            onCreateReel={setReelsPhotoId}
          />
        </>
      )}

      {/* Reels creator modal — "Aprobar y programar" dentro del modal no guarda el post por
          su cuenta, devuelve el vídeo revisado al item vía markReelReady() para que se
          programe por el mismo "Aprobar" que el resto de fotos. */}
      {reelsPhotoId && (() => {
        const targetId = reelsPhotoId;
        const reelsItem = items.find((i) => i.id === targetId);
        if (!reelsItem?.r2Url || !reelsItem.r2Key) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.75)" }}
            onClick={() => setReelsPhotoId(null)}
          >
            <div
              className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-3xl border border-gray-200 bg-white p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-blue-600">Crear Reel</h3>
                <button
                  type="button"
                  onClick={() => setReelsPhotoId(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-900"
                >
                  ✕
                </button>
              </div>
              <ReelsCreator
                imageUrl={reelsItem.r2Url}
                imageKey={reelsItem.r2Key}
                saasId={saasId}
                campaignId={campaignId}
                batchIndex={reelsItem.batchIndex}
                onApproved={({ videoUrl, suggestedPost }) => {
                  markReelReady(targetId, videoUrl, suggestedPost);
                  setReelsPhotoId(null);
                }}
                onClose={() => setReelsPhotoId(null)}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
