"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { Calendar } from "@/app/components/socialflow/Calendar";
import type { SocialCampaign, SocialPost } from "@/app/components/socialflow/types";

// ── Section wrapper ───────────────────────────────────────────────────────────

function DarkSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/4 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-white/35">{subtitle}</p>}
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
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
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

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saasId]);

  const emptyCampaigns: SocialCampaign[] = [];

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/5 p-6">
        <h2 className="text-xl font-black text-white">¿Qué publicamos hoy?</h2>
        <p className="mt-1.5 text-sm text-white/50">
          Sube una foto y la IA genera el caption, hashtags y horario óptimo.
        </p>
        <button
          onClick={() => router.push("/socialflow/upload")}
          className="mt-5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:-translate-y-0.5 hover:brightness-110"
        >
          ✦ Subir foto
        </button>
      </section>

      {/* ── Weekly calendar ──────────────────────────────────────────────── */}
      <DarkSection title="Calendario semanal" subtitle="Visualiza tu contenido semanal">
        <Calendar posts={posts} campaigns={emptyCampaigns} />
      </DarkSection>
    </div>
  );
}
