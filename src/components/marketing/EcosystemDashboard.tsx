"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Facebook, Instagram, Linkedin } from "lucide-react";

// Dashboard público del ecosistema: carga /api/ecosystem/metrics en el cliente. Si la
// API falla, pinta la última respuesta buena guardada en localStorage.

type Platform = "instagram" | "facebook" | "linkedin";
type Status = "active" | "beta" | "development";

type PlatformData = {
  followers: number;
  posts: number;
  engagement: number;
  reach7d: number;
  impressions7d: number;
  username: string;
  profileUrl: string | null;
  source: "live" | "mock";
};

type SaasData = {
  id: string;
  name: string;
  status: Status;
  progress: number;
  platforms: Partial<Record<Platform, PlatformData>>;
};

type MetricsResponse = { lastUpdated: string | null; ecosystem: SaasData[] };

const CACHE_KEY = "drako:ecosystem-metrics";
const PLATFORM_ORDER: Platform[] = ["instagram", "facebook", "linkedin"];

const PLATFORM_META: Record<Platform, { label: string; icon: ReactNode }> = {
  instagram: { label: "Instagram", icon: <Instagram className="h-4 w-4" /> },
  facebook: { label: "Facebook", icon: <Facebook className="h-4 w-4" /> },
  linkedin: { label: "LinkedIn", icon: <Linkedin className="h-4 w-4" /> },
};

const STATUS_BADGE: Record<Status, { label: string; className: string }> = {
  active: { label: "Activo", className: "bg-emerald-50 border-emerald-200 text-emerald-700" },
  beta: { label: "Beta", className: "bg-cyan-50 border-cyan-200 text-cyan-700" },
  development: { label: "En desarrollo", className: "bg-slate-100 border-gray-200 text-slate-600" },
};

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(value);
}

function engagementClass(rate: number): string {
  if (rate > 3) return "text-emerald-600 bg-emerald-50";
  if (rate >= 1) return "text-amber-600 bg-amber-50";
  return "text-red-600 bg-red-50";
}

function readCache(): MetricsResponse | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as MetricsResponse) : null;
  } catch {
    return null;
  }
}

function writeCache(data: MetricsResponse) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Almacenamiento bloqueado (modo privado): el dashboard funciona igual sin caché.
  }
}

function ProgressBar({ name, progress }: { name: string; progress: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setWidth(progress));
    return () => cancelAnimationFrame(frame);
  }, [progress]);

  return (
    <div>
      <div className="flex items-center justify-between text-xs font-semibold mb-2">
        <span className="text-slate-500">Progreso</span>
        <span className="text-blue-600">{progress}%</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso de ${name}`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] transition-[width] duration-1000 ease-out"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function PlatformRow({ platform, data }: { platform: Platform; data: PlatformData }) {
  const meta = PLATFORM_META[platform];
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#3b82f6]">{meta.icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 leading-tight">
            {formatCompact(data.followers)} <span className="font-normal text-slate-500">seguidores</span>
          </p>
          {data.username && data.profileUrl ? (
            <a
              href={data.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-xs text-[#06b6d4] hover:underline"
            >
              @{data.username}
            </a>
          ) : (
            <p className="text-xs text-slate-400">{meta.label}</p>
          )}
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${engagementClass(data.engagement)}`}
        title="Engagement rate"
      >
        {data.engagement.toFixed(1)}%
      </span>
    </li>
  );
}

function SaasCard({ saas }: { saas: SaasData }) {
  const badge = STATUS_BADGE[saas.status] ?? STATUS_BADGE.development;
  const platforms = PLATFORM_ORDER.filter((p) => saas.platforms[p]);
  const hasMock = platforms.some((p) => saas.platforms[p]?.source === "mock");

  return (
    <div className="flex flex-col rounded-xl border border-gray-100 bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.06)] transition-shadow hover:shadow-[0_8px_32px_rgba(59,130,246,0.12)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold text-slate-900">{saas.name}</h3>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${badge.className}`}>{badge.label}</span>
      </div>
      <ProgressBar name={saas.name} progress={saas.progress} />
      {platforms.length ? (
        <ul className="mt-5 divide-y divide-gray-100 border-t border-gray-100">
          {platforms.map((p) => (
            <PlatformRow key={p} platform={p} data={saas.platforms[p]!} />
          ))}
        </ul>
      ) : (
        <p className="mt-5 text-sm text-slate-400">Sin redes sociales activas todavía.</p>
      )}
      {hasMock ? (
        <p className="mt-auto pt-4 text-[11px] text-slate-400">Incluye datos de ejemplo: cuenta aún no conectada.</p>
      ) : null}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-[0_4px_24px_rgba(15,23,42,0.06)] animate-pulse">
      <div className="mb-5 flex justify-between">
        <div className="h-5 w-28 rounded bg-slate-100" />
        <div className="h-5 w-16 rounded-full bg-slate-100" />
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100" />
      <div className="mt-6 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-slate-100" />
            <div className="h-4 flex-1 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

function GlobalTotals({ ecosystem }: { ecosystem: SaasData[] }) {
  const all = ecosystem.flatMap((s) => PLATFORM_ORDER.map((p) => s.platforms[p]).filter((d): d is PlatformData => Boolean(d)));
  const followers = all.reduce((sum, d) => sum + d.followers, 0);
  const posts = all.reduce((sum, d) => sum + d.posts, 0);
  const reach = all.reduce((sum, d) => sum + d.reach7d, 0);
  // Engagement medio ponderado por seguidores.
  const engagement = followers > 0 ? all.reduce((sum, d) => sum + d.engagement * d.followers, 0) / followers : 0;

  const items = [
    { value: String(ecosystem.length), label: "SaaS en el ecosistema" },
    { value: formatCompact(followers), label: "seguidores totales" },
    { value: formatCompact(posts), label: "publicaciones" },
    { value: `${engagement.toFixed(1)}%`, label: "engagement medio" },
    { value: formatCompact(reach), label: "alcance 7 días" },
  ];

  return (
    <div className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-gray-100 bg-white p-5 text-center shadow-[0_4px_24px_rgba(15,23,42,0.06)]">
          <p className="text-2xl font-bold bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] bg-clip-text text-transparent">{item.value}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

export function EcosystemDashboard({ showTotals = false }: { showTotals?: boolean }) {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ecosystem/metrics")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<MetricsResponse>;
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        writeCache(json);
      })
      .catch(() => {
        if (cancelled) return;
        const cached = readCache();
        setData(cached);
        setStale(Boolean(cached));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!data?.ecosystem?.length) {
    return <p className="text-center text-slate-500">No se han podido cargar las métricas del ecosistema. Inténtalo más tarde.</p>;
  }

  const updated = data.lastUpdated ? new Date(data.lastUpdated) : null;

  return (
    <div>
      {showTotals ? <GlobalTotals ecosystem={data.ecosystem} /> : null}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {data.ecosystem.map((saas) => (
          <SaasCard key={saas.id} saas={saas} />
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-slate-400">
        {stale ? "Mostrando el último dato conocido. " : ""}
        {updated && !Number.isNaN(updated.getTime())
          ? `Actualizado: ${updated.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}`
          : "Métricas de ejemplo hasta la primera sincronización diaria."}
      </p>
    </div>
  );
}
