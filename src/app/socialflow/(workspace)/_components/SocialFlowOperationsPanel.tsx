"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Calendar } from "@/app/components/socialflow/Calendar";
import type { SocialCampaign, SocialPost } from "@/app/components/socialflow/types";

type CampaignsResponse = { items?: SocialCampaign[] };

// ── Section wrapper ───────────────────────────────────────────────────────────

function PanelSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SocialFlowOperationsPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSaasId = searchParams.get("saasId") ?? "socialflow";

  const [saasId] = useState(initialSaasId);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [campaigns, setCampaigns] = useState<SocialCampaign[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function loadPosts() {
    setError(null);
    try {
      const res = await fetch(`/api/socialflow/posts?saasId=${encodeURIComponent(saasId)}`);
      if (!res.ok) throw new Error("Failed to load posts");
      const json = (await res.json()) as { items?: SocialPost[] };
      setPosts(json.items ?? []);
    } catch (err) {
      console.error("SOCIALFLOW_DASHBOARD_LOAD_ERROR", err);
      setError("No se pudieron cargar los datos");
    }
  }

  // Independiente de loadPosts() a propósito — el calendario no debe esperar a
  // este fetch para pintar los posts. Si falla, campaigns se queda en [] y
  // Calendar ya degrada bien a "Sin campaña" para ese caso.
  async function loadCampaigns() {
    try {
      const res = await fetch(`/api/socialflow/campaigns?saasId=${encodeURIComponent(saasId)}`);
      if (!res.ok) return;
      const json = (await res.json()) as CampaignsResponse;
      setCampaigns(json.items ?? []);
    } catch (err) {
      console.error("SOCIALFLOW_DASHBOARD_CAMPAIGNS_LOAD_ERROR", err);
    }
  }

  useEffect(() => {
    void loadPosts();
    void loadCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saasId]);

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        onClick={() => router.push("/socialflow/upload")}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:brightness-110 transition"
      >
        ✦ Sube, analiza, publica y programa con IA
      </button>

      {/* ── Weekly calendar ──────────────────────────────────────────────── */}
      <PanelSection title="Calendario semanal" subtitle="Visualiza tu contenido semanal">
        <Calendar posts={posts} campaigns={campaigns} />
      </PanelSection>
    </div>
  );
}
