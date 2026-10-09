import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Heart, Instagram, Linkedin, MessageCircle, Share2, Sparkles } from "lucide-react";
import type { ConnectionState, RecentPostItem } from "../_lib/dashboard-data";

const nf = new Intl.NumberFormat("es-ES");

export function Section({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ── Sección 2 · Métricas principales ─────────────────────────────────────────

export type StatStatus = "good" | "attention" | "empty";

export type StatCardModel = { label: string; value: string; detail: string; status: StatStatus; statusLabel: string };

// Estado = punto + texto, nunca solo color.
const STATUS_STYLE: Record<StatStatus, { dot: string; text: string }> = {
  good: { dot: "bg-emerald-400", text: "text-emerald-600" },
  attention: { dot: "bg-amber-400", text: "text-amber-600" },
  empty: { dot: "bg-gray-300", text: "text-gray-400" },
};

export function StatCards({ cards }: { cards: StatCardModel[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const style = STATUS_STYLE[card.status];
        return (
          <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-[#3b82f6]/40">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">{card.label}</p>
            <p className="mt-2 text-4xl font-black tracking-tight text-[#3b82f6]">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-gray-500">{card.detail}</p>
            <p className={`mt-3 flex items-center gap-1.5 text-[11px] font-semibold ${style.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
              {card.statusLabel}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Sección 4 · Tu siguiente paso ────────────────────────────────────────────

export type NextStep = { title: string; description: string; href: string; cta: string };

export function NextSteps({ steps }: { steps: NextStep[] }) {
  return (
    <Section title="Tu siguiente paso" subtitle="Lo más importante ahora mismo, según el estado de tu cuenta">
      <ul className="space-y-2">
        {steps.map((step, i) => (
          <li key={step.title}>
            <Link
              href={step.href}
              className={`group flex items-center gap-4 rounded-xl border px-4 py-3 transition ${
                i === 0 ? "border-[#3b82f6]/40 bg-[#3b82f6]/5 hover:bg-[#3b82f6]/10" : "border-gray-200 bg-gray-50 hover:border-gray-300"
              }`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${i === 0 ? "bg-[#3b82f6] text-white" : "bg-gray-200 text-gray-600"}`}>
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-gray-900">{step.title}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{step.description}</span>
              </span>
              <span className="hidden shrink-0 items-center gap-1 text-xs font-bold text-[#3b82f6] sm:flex">
                {step.cta} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ── Sección 5 · CTA central ──────────────────────────────────────────────────

export function PublishCta() {
  return (
    <Link
      href="/socialflow/upload"
      className="group relative block overflow-hidden rounded-2xl border border-[#3b82f6]/30 bg-gradient-to-br from-[#3b82f6]/10 via-white to-white p-7 transition duration-300 hover:border-[#3b82f6]/60 hover:shadow-[0_0_48px_rgba(59,130,246,0.18)] sm:p-9"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#3b82f6]/15 blur-[70px] transition duration-300 group-hover:bg-[#3b82f6]/25" aria-hidden="true" />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#3b82f6]">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Crear contenido
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">¿Qué quieres publicar hoy?</h2>
          <p className="mt-1.5 text-sm text-gray-600">Sube una foto. SocialCors se encarga del resto.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-6 py-3 text-sm font-bold text-white transition group-hover:brightness-110">
          Subir y publicar <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

// ── Sección 7 · Últimas publicaciones ────────────────────────────────────────

function formatPostDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function RecentPosts({ posts }: { posts: RecentPostItem[] }) {
  return (
    <Section title="Últimas publicaciones" subtitle="Tus 5 posts más recientes y cómo les va">
      {posts.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-5">
          <p className="text-sm text-gray-600">Todavía no has publicado nada con SocialCors.</p>
          <Link href="/socialflow/upload" className="rounded-full bg-[#3b82f6] px-4 py-1.5 text-xs font-bold text-white transition hover:brightness-110">
            Crea tu primera publicación
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-gray-200">
          {posts.map((post) => (
            <li key={post.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              {post.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.thumbnail} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 object-cover" />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#3b82f6]/25 bg-[#3b82f6]/10 text-[10px] font-bold uppercase text-[#3b82f6]">
                  {post.type.slice(0, 4)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[11px] text-gray-500">
                  <span className="rounded-full bg-[#3b82f6]/10 px-2 py-0.5 font-bold text-[#3b82f6]">{post.type}</span>
                  {formatPostDate(post.postedAt)}
                </p>
                <p className="mt-1 truncate text-sm text-gray-700">{post.excerpt || "Sin texto"}</p>
              </div>
              {post.metrics ? (
                <div className="flex shrink-0 items-center gap-3 text-xs text-gray-600">
                  <span className="flex items-center gap-1" title="Likes"><Heart className="h-3.5 w-3.5" aria-hidden="true" />{nf.format(post.metrics.likes)}</span>
                  <span className="flex items-center gap-1" title="Comentarios"><MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />{nf.format(post.metrics.comments)}</span>
                  <span className="flex items-center gap-1" title="Shares"><Share2 className="h-3.5 w-3.5" aria-hidden="true" />{nf.format(post.metrics.shares)}</span>
                </div>
              ) : (
                <span className="shrink-0 text-[11px] text-gray-400">Métricas pendientes</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ── Sección 8 · Estado de conexiones ─────────────────────────────────────────

const CONNECTION_LABEL: Record<ConnectionState, { text: string; dot: string; color: string }> = {
  connected: { text: "Conectado", dot: "bg-emerald-400", color: "text-emerald-600" },
  pending: { text: "Pendiente de verificar", dot: "bg-amber-400", color: "text-amber-600" },
  needs_reconnection: { text: "Requiere reconectar", dot: "bg-amber-400", color: "text-amber-600" },
  disconnected: { text: "No conectado", dot: "bg-gray-300", color: "text-gray-400" },
};

export function Connections({ instagram, linkedin, linkedinAvailable }: { instagram: ConnectionState; linkedin: ConnectionState; linkedinAvailable: boolean }) {
  const items = [
    { key: "instagram", name: "Instagram", icon: <Instagram className="h-5 w-5" aria-hidden="true" />, state: instagram, soon: false },
    { key: "linkedin", name: "LinkedIn", icon: <Linkedin className="h-5 w-5" aria-hidden="true" />, state: linkedin, soon: !linkedinAvailable && linkedin === "disconnected" },
  ];
  return (
    <Section title="Estado de conexiones" subtitle="Las redes que SocialCors puede usar por ti">
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const label = item.soon ? { text: "Próximamente", dot: "bg-gray-300", color: "text-gray-400" } : CONNECTION_LABEL[item.state];
          const needsAction = !item.soon && item.state !== "connected";
          return (
            <div key={item.key} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3b82f6]/10 text-[#3b82f6]">{item.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-gray-900">{item.name}</p>
                <p className={`mt-0.5 flex items-center gap-1.5 text-xs font-medium ${label.color}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${label.dot}`} aria-hidden="true" />
                  {label.text}
                </p>
              </div>
              {needsAction && (
                <Link href="/socialflow/redes" className="shrink-0 rounded-full bg-[#3b82f6] px-4 py-1.5 text-xs font-bold text-white transition hover:brightness-110">
                  {item.state === "needs_reconnection" ? "Reconectar" : "Conectar"}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
