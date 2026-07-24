"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SaasSocialCampaign, SaasSocialCampaignStatus, SaasSocialPost } from "@/lib/social-core/types";
import CampaignPhotoUpload from "./campaign-photo-upload";
import { useCampaignPhotoBatch, PhotoBatchGrid } from "./campaign-photo-batch";
import ReelsCreator from "./reels-creator";

type Props = {
  campaigns: SaasSocialCampaign[];
  saasId: string;
  maxImages: number;
};

const STATUS_CFG: Record<SaasSocialCampaignStatus, { label: string; chipBg: string; dotBg: string }> = {
  DRAFT:      { label: "Borrador",       chipBg: "bg-white/8 text-white/55",           dotBg: "bg-white/40"    },
  GENERATING: { label: "Generando (IA)", chipBg: "bg-violet-500/15 text-violet-300",   dotBg: "bg-violet-500"  },
  ACTIVE:     { label: "Activa",         chipBg: "bg-emerald-500/15 text-emerald-300", dotBg: "bg-emerald-500" },
  PAUSED:     { label: "Pausada",        chipBg: "bg-amber-500/15 text-amber-300",     dotBg: "bg-amber-500"   },
  FINISHED:   { label: "Terminada",      chipBg: "bg-indigo-500/15 text-indigo-300",   dotBg: "bg-indigo-500"  },
  ARCHIVED:   { label: "Archivada",      chipBg: "bg-white/6 text-white/40",           dotBg: "bg-white/25"    },
  FAILED:     { label: "Error IA",       chipBg: "bg-rose-500/15 text-rose-400",       dotBg: "bg-rose-500"    },
};

// Solo se listan como sección aparte si tienen al menos una campaña — así GENERATING/FAILED
// (estados que solo gestiona la IA) no ensucian la vista cuando no hay ninguna en ese estado.
const SECTIONS: { key: SaasSocialCampaignStatus; label: string }[] = [
  { key: "ACTIVE", label: "Activas" },
  { key: "PAUSED", label: "Pausadas" },
  { key: "DRAFT", label: "En borrador" },
  { key: "FINISHED", label: "Terminadas" },
  { key: "ARCHIVED", label: "Archivadas" },
  { key: "GENERATING", label: "Generando con IA" },
  { key: "FAILED", label: "Con errores" },
];

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function actionBtnClass(tone: "emerald" | "amber" | "indigo" | "rose" | "rose-ghost" | "neutral") {
  const toneClass: Record<typeof tone, string> = {
    emerald: "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25",
    amber: "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25",
    indigo: "bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25",
    rose: "bg-rose-500/20 text-rose-200 hover:bg-rose-500/30",
    "rose-ghost": "bg-white/5 text-rose-300/70 hover:bg-rose-500/15 hover:text-rose-300",
    neutral: "bg-white/6 text-white/60 hover:bg-white/10 hover:text-white",
  };
  return `rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${toneClass[tone]}`;
}

function CampaignDraftPosts({ campaignId, saasId }: { campaignId: string; saasId: string }) {
  const router = useRouter();
  const [posts, setPosts] = useState<SaasSocialPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPosts(null);
    setError(null);
    fetch(`/api/socialflow/posts?saasId=${encodeURIComponent(saasId)}&campaignId=${encodeURIComponent(campaignId)}&status=DRAFT`)
      .then((res) => {
        if (!res.ok) throw new Error("request_failed");
        return res.json() as Promise<{ items?: SaasSocialPost[] }>;
      })
      .then((json) => {
        if (!cancelled) setPosts(json.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar los posts de esta campaña.");
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, saasId]);

  function reviewPost(postId: string, action: "approve" | "reject") {
    setPendingId(postId);
    fetch("/api/socialflow/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: postId, saasId, action }),
    })
      .then((res) => res.json() as Promise<{ post?: SaasSocialPost }>)
      .then((json) => {
        if (json.post) {
          setPosts((prev) => (prev ?? []).filter((post) => post.id !== postId));
        }
      })
      .finally(() => {
        setPendingId(null);
        router.refresh();
      });
  }

  if (error) {
    return <p className="px-4 pb-4 text-xs text-rose-300">{error}</p>;
  }
  if (posts === null) {
    return <p className="px-4 pb-4 text-xs text-white/40">Cargando posts…</p>;
  }
  if (posts.length === 0) {
    return <p className="px-4 pb-4 text-xs text-white/35">No hay posts en borrador para esta campaña.</p>;
  }

  return (
    <div className="space-y-2 px-4 pb-4">
      {posts.map((post) => (
        <div key={post.id} className="rounded-xl border border-white/8 bg-white/3 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{post.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-white/45">{post.body}</p>
              {post.scheduledAt && (
                <p className="mt-1 text-[11px] text-white/30">Programado: {formatDate(post.scheduledAt)}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                disabled={pendingId === post.id}
                onClick={() => reviewPost(post.id, "approve")}
                className={actionBtnClass("emerald")}
              >
                Aprobar
              </button>
              <button
                type="button"
                disabled={pendingId === post.id}
                onClick={() => reviewPost(post.id, "reject")}
                className={actionBtnClass("rose-ghost")}
              >
                Rechazar
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// [startDate, endDate] inclusive, en días — mismo criterio que buildDateRange en
// /api/socialflow/campaigns/[id]/photos/route.ts (ventana de la campaña).
function inclusiveDayCount(startDate: string, endDate: string): number {
  const ms = new Date(endDate + "T00:00:00Z").getTime() - new Date(startDate + "T00:00:00Z").getTime();
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}

function CreateCampaignWizard({
  saasId,
  maxImages,
  onCreated,
}: {
  saasId: string;
  maxImages: number;
  onCreated: (campaign: SaasSocialCampaign) => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [targetSegment, setTargetSegment] = useState("");
  const [budgetEstimate, setBudgetEstimate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [postCount, setPostCount] = useState(1);
  const [reelCount, setReelCount] = useState(0);
  const [historiaCount, setHistoriaCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCampaign, setCreatedCampaign] = useState<SaasSocialCampaign | null>(null);
  const [reelsPhotoId, setReelsPhotoId] = useState<string | null>(null);

  const minPhotos = startDate && endDate ? inclusiveDayCount(startDate, endDate) : 1;
  const exceedsPlan = minPhotos > maxImages;

  // Mantiene postCount alineado con minPhotos mientras el usuario no lo edite manualmente
  // después de fijar las fechas — sigue contando como "default: minPhotos".
  useEffect(() => {
    setPostCount(minPhotos);
  }, [minPhotos]);

  const batch = useCampaignPhotoBatch({
    campaignId: createdCampaign?.id ?? "",
    saasId,
    maxImages,
    autoProcess: false,
  });

  function resetAll() {
    setStep(1);
    setName("");
    setObjective("");
    setTargetSegment("");
    setBudgetEstimate("");
    setStartDate("");
    setEndDate("");
    setPostCount(1);
    setReelCount(0);
    setHistoriaCount(0);
    setError(null);
    setCreatedCampaign(null);
    setOpen(false);
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!startDate || !endDate) {
      setError("Indica fecha de inicio y fin para calcular cuántas fotos necesitas.");
      return;
    }
    if (endDate < startDate) {
      setError("La fecha de fin no puede ser anterior a la de inicio.");
      return;
    }
    if (inclusiveDayCount(startDate, endDate) > maxImages) {
      setError(
        `Tu plan permite un máximo de ${maxImages} fotos. Acorta la campaña a ${maxImages} día${maxImages === 1 ? "" : "s"} o menos.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/socialflow/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saasId,
          name: name.trim(),
          objective: objective.trim() || undefined,
          targetSegment: targetSegment.trim() || undefined,
          budgetEstimate: budgetEstimate.trim() ? Number(budgetEstimate) : null,
          startDate,
          endDate,
          postCount,
          reelCount,
          historiaCount,
        }),
      });
      const data = (await res.json().catch(() => null)) as { campaign?: SaasSocialCampaign; message?: string } | null;
      if (!res.ok || !data?.campaign) {
        throw new Error(data?.message ?? "No se pudo crear la campaña");
      }
      onCreated(data.campaign);
      setCreatedCampaign(data.campaign);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la campaña");
    } finally {
      setSubmitting(false);
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5 hover:brightness-110"
      >
        + Nueva campaña
      </button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-2xl border border-white/8 bg-white/4 p-4">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-white/30">
        <span className={step === 1 ? "text-violet-300" : ""}>1. Datos</span>
        <span>→</span>
        <span className={step === 2 ? "text-violet-300" : ""}>2. Fotos</span>
        <span>→</span>
        <span className={step === 3 ? "text-violet-300" : ""}>3. Confirmar</span>
      </div>

      {step === 1 && (
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de campaña"
              required
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
            <input
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Objetivo (ej. AWARENESS)"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
            <input
              value={targetSegment}
              onChange={(e) => setTargetSegment(e.target.value)}
              placeholder="Audiencia objetivo"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
            <input
              value={budgetEstimate}
              onChange={(e) => setBudgetEstimate(e.target.value)}
              placeholder="Presupuesto estimado (€)"
              inputMode="numeric"
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-white/30">Fecha de inicio</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-white/30">Fecha de fin</label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
              />
            </div>
          </div>
          {startDate && endDate && (
            <p className={`text-xs ${exceedsPlan ? "text-rose-300" : "text-white/40"}`}>
              Esta campaña dura {minPhotos} día{minPhotos === 1 ? "" : "s"} → necesitarás al menos {minPhotos} foto
              {minPhotos === 1 ? "" : "s"} (máximo de tu plan: {maxImages}).
            </p>
          )}
          {startDate && endDate && (
            <div className="space-y-2 rounded-xl border border-white/8 bg-white/3 p-3">
              <p className="text-xs font-semibold text-white/60">¿Qué tipo de contenido quieres en esta campaña?</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-white/30">Posts 📸</label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={postCount}
                    onChange={(e) => setPostCount(Number(e.target.value))}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-white/30">Reels 🎬</label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={reelCount}
                    onChange={(e) => setReelCount(Number(e.target.value))}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-white/30">Historias ⭕</label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={historiaCount}
                    onChange={(e) => setHistoriaCount(Number(e.target.value))}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  />
                </div>
              </div>
              <p className="text-xs text-white/40">Total: {postCount + reelCount + historiaCount} piezas de contenido</p>
            </div>
          )}
          {error && <p className="text-xs text-rose-300">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-400 disabled:opacity-50"
            >
              {submitting ? "Creando…" : "Siguiente →"}
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/50 transition hover:text-white/70"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {step === 2 && createdCampaign && (
        <div className="space-y-3">
          <p className="text-sm text-white/60">
            &ldquo;{createdCampaign.name}&rdquo; dura {minPhotos} día{minPhotos === 1 ? "" : "s"} → sube al menos {minPhotos} foto
            {minPhotos === 1 ? "" : "s"} (1 por día).
          </p>
          {batch.globalError && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              {batch.globalError}
            </div>
          )}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/12 bg-white/3 p-8 text-center transition hover:border-violet-500/40 hover:bg-violet-500/5"
          >
            <p className="text-sm font-semibold text-white/70">Arrastra o haz click para subir las fotos de la campaña</p>
            <p className="text-xs text-white/30">
              {batch.uploadedCount}/{minPhotos} fotos subidas · máximo {maxImages}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) void batch.addFiles(e.target.files);
              }}
            />
          </div>
          {batch.items.length > 0 && (
            <PhotoBatchGrid items={batch.items} onRemove={batch.removeItem} onApprove={batch.approveItem} onEditBody={batch.editBody} onEditContentType={batch.editContentType} />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={batch.uploadedCount < minPhotos}
              onClick={() => setStep(3)}
              className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuar →
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/50 transition hover:text-white/70"
            >
              Cerrar y continuar más tarde
            </button>
          </div>
        </div>
      )}

      {step === 3 && createdCampaign && (
        <div className="space-y-3">
          {batch.readyCount === 0 && batch.savedCount === 0 ? (
            <>
              <p className="text-sm text-white/60">
                Vas a generar {batch.uploadedCount} posts coordinados para &ldquo;{createdCampaign.name}&rdquo;.
              </p>
              <button
                type="button"
                disabled={batch.confirming}
                onClick={() => void batch.confirmAndGenerate()}
                className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-110 disabled:opacity-50"
              >
                {batch.confirming ? "Generando con IA…" : "Confirmar y generar con IA"}
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-white/40">
                  {batch.savedCount} programada{batch.savedCount !== 1 ? "s" : ""} de {batch.activeCount}
                </p>
                {batch.readyCount >= 1 && (
                  <button
                    type="button"
                    onClick={() => void batch.approveAll()}
                    className="rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
                  >
                    Aprobar todo ({batch.readyCount})
                  </button>
                )}
              </div>
              <PhotoBatchGrid
                items={batch.items}
                onRemove={batch.removeItem}
                onApprove={batch.approveItem}
                onEditBody={batch.editBody}
                onEditContentType={batch.editContentType}
                onCreateReel={setReelsPhotoId}
              />
              {batch.savedCount === batch.activeCount && batch.activeCount > 0 && (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                  Campaña lista ✓
                </div>
              )}
            </>
          )}
          <button
            type="button"
            onClick={resetAll}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/50 transition hover:text-white/70"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Reels creator modal — paso 3, opción "Reel" por foto */}
      {reelsPhotoId && createdCampaign && (() => {
        const reelsItem = batch.items.find((i) => i.id === reelsPhotoId);
        if (!reelsItem?.r2Url || !reelsItem.r2Key) return null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            style={{ background: "rgba(0,0,0,0.75)" }}
            onClick={() => setReelsPhotoId(null)}
          >
            <div
              className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-3xl border border-white/10 bg-[#0d0d1e] p-5 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest text-violet-400">Crear Reel</h3>
                <button
                  type="button"
                  onClick={() => setReelsPhotoId(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 transition hover:bg-white/20 hover:text-white"
                >
                  ✕
                </button>
              </div>
              <ReelsCreator
                imageUrl={reelsItem.r2Url}
                imageKey={reelsItem.r2Key}
                saasId={saasId}
                campaignId={createdCampaign.id}
                onClose={() => setReelsPhotoId(null)}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function CampaignsBoard({ campaigns: initialCampaigns, saasId, maxImages }: Props) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadingPhotosId, setUploadingPhotosId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function changeStatus(campaign: SaasSocialCampaign, status: SaasSocialCampaignStatus) {
    setPendingId(campaign.id);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/socialflow/campaigns", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: campaign.id, saasId, status }),
        });
        const data = (await res.json().catch(() => null)) as { campaign?: SaasSocialCampaign; message?: string } | null;
        if (res.ok && data?.campaign) {
          setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? data.campaign! : c)));
        } else {
          setError(data?.message ?? "No se pudo actualizar la campaña");
        }
      } catch {
        setError("No se pudo actualizar la campaña");
      } finally {
        setPendingId(null);
        router.refresh();
      }
    });
  }

  function deleteCampaign(campaignId: string) {
    setPendingId(campaignId);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/socialflow/campaigns?id=${encodeURIComponent(campaignId)}&saasId=${encodeURIComponent(saasId)}`,
          { method: "DELETE" },
        );
        if (res.ok) {
          setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
          setExpandedId((current) => (current === campaignId ? null : current));
        } else {
          const data = (await res.json().catch(() => null)) as { message?: string } | null;
          setError(data?.message ?? "No se pudo borrar la campaña");
        }
      } catch {
        setError("No se pudo borrar la campaña");
      } finally {
        setPendingId(null);
        setConfirmingDeleteId(null);
        router.refresh();
      }
    });
  }

  const grouped = SECTIONS.map((section) => ({
    ...section,
    items: campaigns.filter((c) => c.status === section.key),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <CreateCampaignWizard
          saasId={saasId}
          maxImages={maxImages}
          onCreated={(campaign) => setCampaigns((prev) => [campaign, ...prev])}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
      )}

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/4 p-8 text-center">
          <p className="text-sm text-white/50">Todavía no hay campañas. Crea la primera para empezar a organizar tu contenido.</p>
        </div>
      ) : (
        grouped.map((section) => (
          <div key={section.key} className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/35">
              {section.label} <span className="text-white/20">· {section.items.length}</span>
            </h2>
            <div className="space-y-3">
              {section.items.map((campaign) => {
                const cfg = STATUS_CFG[campaign.status];
                const isExpanded = expandedId === campaign.id;
                const isUploadingPhotos = uploadingPhotosId === campaign.id;
                const isBusy = pendingId === campaign.id;
                const isConfirmingDelete = confirmingDeleteId === campaign.id;
                const canDelete = campaign.status !== "GENERATING";

                return (
                  <div key={campaign.id} className="rounded-2xl border border-white/8 bg-white/4">
                    <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold text-white">{campaign.name}</h3>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${cfg.chipBg}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotBg}`} />
                            {cfg.label}
                          </span>
                        </div>
                        {campaign.objective && <p className="text-sm text-white/50">{campaign.objective}</p>}
                        <p className="text-xs text-white/35">
                          Audiencia: {campaign.targetSegment}
                          {campaign.budgetEstimate != null ? ` · Presupuesto: ${campaign.budgetEstimate}€` : ""}
                          {formatDate(campaign.startDate) ? ` · Desde ${formatDate(campaign.startDate)}` : ""}
                          {formatDate(campaign.endDate) ? ` hasta ${formatDate(campaign.endDate)}` : ""}
                        </p>
                        {campaign.status === "FAILED" && campaign.notes && (
                          <p className="text-xs text-rose-300/80">{campaign.notes}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {(campaign.status === "DRAFT" || campaign.status === "PAUSED") && (
                          <button type="button" disabled={isBusy} onClick={() => changeStatus(campaign, "ACTIVE")} className={actionBtnClass("emerald")}>
                            Activar
                          </button>
                        )}
                        {campaign.status === "ACTIVE" && (
                          <button type="button" disabled={isBusy} onClick={() => changeStatus(campaign, "PAUSED")} className={actionBtnClass("amber")}>
                            Pausar
                          </button>
                        )}
                        {(campaign.status === "ACTIVE" || campaign.status === "PAUSED") && (
                          <button type="button" disabled={isBusy} onClick={() => changeStatus(campaign, "FINISHED")} className={actionBtnClass("indigo")}>
                            Finalizar
                          </button>
                        )}
                        {campaign.status !== "ARCHIVED" && campaign.status !== "GENERATING" && (
                          <button type="button" disabled={isBusy} onClick={() => changeStatus(campaign, "ARCHIVED")} className={actionBtnClass("neutral")}>
                            Archivar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setUploadingPhotosId(isUploadingPhotos ? null : campaign.id)}
                          className={actionBtnClass("neutral")}
                        >
                          {isUploadingPhotos ? "Cerrar subida" : "Subir fotos"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : campaign.id)}
                          className={actionBtnClass("neutral")}
                        >
                          {isExpanded ? "Ocultar borradores" : "Ver borradores"}
                        </button>
                        {canDelete && (
                          isConfirmingDelete ? (
                            <span className="flex items-center gap-1.5">
                              <button type="button" disabled={isBusy} onClick={() => deleteCampaign(campaign.id)} className={actionBtnClass("rose")}>
                                {isBusy ? "Borrando…" : "Confirmar borrado"}
                              </button>
                              <button type="button" onClick={() => setConfirmingDeleteId(null)} className={actionBtnClass("neutral")}>
                                Cancelar
                              </button>
                            </span>
                          ) : (
                            <button type="button" onClick={() => setConfirmingDeleteId(campaign.id)} className={actionBtnClass("rose-ghost")}>
                              Borrar
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {isUploadingPhotos && (
                      <div className="border-t border-white/8">
                        <CampaignPhotoUpload campaignId={campaign.id} saasId={saasId} maxImages={maxImages} />
                      </div>
                    )}

                    {isExpanded && (
                      <div className="border-t border-white/8">
                        <CampaignDraftPosts campaignId={campaign.id} saasId={saasId} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
