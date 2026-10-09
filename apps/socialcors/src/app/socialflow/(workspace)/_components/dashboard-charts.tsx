"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EngagementWeekPoint, FollowerPoint, ViewsPoint } from "../_lib/dashboard-data";

// Series de engagement — paleta categórica validada con validate_palette.js
// (lightness band, chroma, CVD ΔE ≥ 8 y contraste ≥ 3:1 sobre superficie clara).
export const ENGAGEMENT_COLORS = { likes: "#7c5cff", comments: "#0891b2", shares: "#db2777" } as const;

const BRAND = "#3b82f6";
const CYAN = "#06b6d4";
const AXIS = "rgba(17,24,39,0.45)";
const GRID = "rgba(17,24,39,0.08)";

const nf = new Intl.NumberFormat("es-ES");

function ChartCard({ title, subtitle, children, aside }: { title: string; subtitle: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function EmptyChart({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 text-center">
      <svg width="44" height="24" viewBox="0 0 44 24" fill="none" aria-hidden="true">
        <path d="M2 20 L12 12 L20 16 L32 5 L42 9" stroke={BRAND} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 4" opacity="0.7" />
      </svg>
      <div>
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        <p className="mt-1 max-w-xs text-xs leading-5 text-gray-500">{body}</p>
      </div>
      {cta && (
        <Link href={cta.href} className="rounded-full bg-[#3b82f6] px-4 py-1.5 text-xs font-bold text-white transition hover:brightness-110">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

const tooltipBox = "rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg";

// ── Gráfica 1 · Evolución de seguidores ──────────────────────────────────────

function formatDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function FollowersChart({ history, instagramConnected }: { history: FollowerPoint[]; instagramConnected: boolean }) {
  const title = "Evolución de seguidores";
  const subtitle = "Últimos 30 días · Instagram";

  if (history.length < 2) {
    return (
      <ChartCard title={title} subtitle={subtitle}>
        {instagramConnected ? (
          <EmptyChart title="Recopilando tu historial" body="Guardamos tus seguidores cada pocas horas. En un par de días verás aquí tu evolución." />
        ) : (
          <EmptyChart title="Aún no hay datos de seguidores" body="Conecta Instagram para ver tu evolución." cta={{ href: "/socialflow/redes", label: "Conecta Instagram para ver tu evolución" }} />
        )}
      </ChartCard>
    );
  }

  const values = history.map((p) => p.followers);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(2, Math.ceil((max - min) * 0.2));
  const data = history.map((p) => ({ label: formatDay(p.date), followers: p.followers }));

  return (
    <ChartCard title={title} subtitle={subtitle}>
      <div className="h-56" role="img" aria-label={`Seguidores de ${nf.format(values[0])} a ${nf.format(values[values.length - 1])} en ${history.length} días`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="dash-followers-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND} stopOpacity={0.4} />
                <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={44} domain={[Math.max(0, min - pad), max + pad]} tickFormatter={(v: number) => nf.format(Math.round(v))} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: "rgba(17,24,39,0.15)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className={tooltipBox}>
                    <p className="text-gray-500">{label}</p>
                    <p className="mt-0.5 font-bold text-gray-900">{nf.format(Number(payload[0].value))} seguidores</p>
                  </div>
                ) : null
              }
            />
            <Area type="monotone" dataKey="followers" stroke={BRAND} strokeWidth={2} fill="url(#dash-followers-fill)" activeDot={{ r: 5, fill: BRAND, stroke: "#ffffff", strokeWidth: 2 }} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ── Gráfica 2 · Visualizaciones por post ─────────────────────────────────────

export function ViewsByPostChart({ posts }: { posts: ViewsPoint[] }) {
  const title = "Visualizaciones por post";
  const subtitle = "Últimos 30 días · una barra por publicación";

  if (posts.length === 0) {
    return (
      <ChartCard title={title} subtitle={subtitle}>
        <EmptyChart title="Sin visualizaciones todavía" body="Cuando publiques y tus métricas se sincronicen, verás aquí cuánto ha visto cada post." />
      </ChartCard>
    );
  }

  const data = posts.map((p) => ({ ...p, key: p.id }));

  return (
    <ChartCard title={title} subtitle={subtitle}>
      <div className="h-56" role="img" aria-label={`Visualizaciones de ${posts.length} publicaciones de los últimos 30 días`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="25%">
            <defs>
              <linearGradient id="dash-views-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CYAN} />
                <stop offset="100%" stopColor={BRAND} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
            <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={44} allowDecimals={false} tickFormatter={(v: number) => nf.format(v)} />
            <Tooltip
              cursor={{ fill: "rgba(17,24,39,0.04)" }}
              content={({ active, payload }) => {
                const p = active && payload?.length ? (payload[0].payload as ViewsPoint) : null;
                return p ? (
                  <div className={`${tooltipBox} max-w-[240px]`}>
                    <p className="text-gray-500">{p.type} · {p.dateLabel}</p>
                    {p.excerpt && <p className="mt-1 leading-4 text-gray-700">{p.excerpt}</p>}
                    <p className="mt-1.5 font-bold text-gray-900">{nf.format(p.views)} visualizaciones</p>
                  </div>
                ) : null;
              }}
            />
            <Bar dataKey="views" fill="url(#dash-views-fill)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

// ── Gráfica 3 · Engagement desglosado por semana ─────────────────────────────

const ENGAGEMENT_SERIES = [
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comentarios" },
  { key: "shares", label: "Shares" },
] as const;

export function EngagementChart({ weeks, totals }: { weeks: EngagementWeekPoint[]; totals: { likes: number; comments: number; shares: number } }) {
  const title = "Engagement desglosado";
  const subtitle = "Últimos 30 días · por semana de publicación";
  const hasData = weeks.some((w) => w.likes + w.comments + w.shares > 0);

  if (!hasData) {
    return (
      <ChartCard title={title} subtitle={subtitle}>
        <EmptyChart title="Sin interacciones todavía" body="Aquí verás likes, comentarios y shares de tus publicaciones, semana a semana." />
      </ChartCard>
    );
  }

  const legend = (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {ENGAGEMENT_SERIES.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ENGAGEMENT_COLORS[s.key] }} aria-hidden="true" />
          {s.label} <span className="font-semibold text-gray-900">{nf.format(totals[s.key])}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <ChartCard title={title} subtitle={subtitle} aside={legend}>
      <div className="h-56" role="img" aria-label={`Likes ${totals.likes}, comentarios ${totals.comments}, shares ${totals.shares} en los últimos 30 días`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={weeks} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={44} allowDecimals={false} tickFormatter={(v: number) => nf.format(v)} />
            <Tooltip
              cursor={{ stroke: "rgba(17,24,39,0.15)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className={tooltipBox}>
                    <p className="text-gray-500">Semana {label}</p>
                    {ENGAGEMENT_SERIES.map((s) => (
                      <p key={s.key} className="mt-0.5 flex items-center gap-1.5 text-gray-700">
                        <span className="h-2 w-2 rounded-sm" style={{ background: ENGAGEMENT_COLORS[s.key] }} aria-hidden="true" />
                        {s.label}: <span className="font-bold text-gray-900">{nf.format(Number(payload.find((x) => x.dataKey === s.key)?.value ?? 0))}</span>
                      </p>
                    ))}
                  </div>
                ) : null
              }
            />
            {ENGAGEMENT_SERIES.map((s) => (
              <Area key={s.key} type="monotone" stackId="eng" dataKey={s.key} name={s.label} stroke={ENGAGEMENT_COLORS[s.key]} strokeWidth={1.5} fill={ENGAGEMENT_COLORS[s.key]} fillOpacity={0.45} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
