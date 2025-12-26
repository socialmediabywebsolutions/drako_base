import { notFound } from "next/navigation";
import ExperienceSection from "./ExperienceSection";
import { resolveEconomyContext, listSaasServices } from "@/lib/economy/repository";
import { getSaasPublicProfile } from "@/lib/saas/repository";
import { resolveBrandingContext, resolveEffectiveTheme } from "@/lib/branding/repository";

type PageProps = {
  params: Promise<{ slug: string }>;
};

const TRUST_POINTS = [
  { title: "Coloristas certificados", detail: "Protocolos de seguridad y tonos personalizados." },
  { title: "Agenda inteligente", detail: "Reservas confirmadas en minutos y sin esperas." },
  { title: "Cuidado premium", detail: "Productos profesionales y diagnóstico rápido." },
];

const REVIEWS = [
  { name: "Marina G.", detail: "El color quedó exacto a la referencia. Muy cuidadas.", rating: 5 },
  { name: "Celia R.", detail: "Todo fluido, la reserva online me salvó la semana.", rating: 5 },
  { name: "Nuria F.", detail: "Me explicaron cada paso, salí encantada con el corte.", rating: 4 },
];

export default async function PublicSaasPage({ params }: PageProps) {
  const { slug } = await params;
  const profile = await getSaasPublicProfile(slug);
  if (!profile) return notFound();
  const economyCtx = await resolveEconomyContext({ tenantId: profile.tenantId, saasId: profile.saasId });
  const services = (await listSaasServices(economyCtx)).filter((service) => service.isActive);
  const topServices = services.slice(0, 6);
  const brandingCtx = await resolveBrandingContext({ tenantId: profile.tenantId, saasId: profile.saasId });
  const theme = await resolveEffectiveTheme(brandingCtx, {});
  const themeVars = {
    "--drako-primary": theme.colors.primary,
    "--drako-secondary": theme.colors.secondary,
    "--drako-accent": theme.colors.accent,
    "--drako-bg": theme.colors.background,
    "--drako-surface": theme.colors.surface,
    "--drako-text": theme.colors.text,
  } as Record<string, string>;

  return (
    <div
      className="min-h-screen"
      style={{
        ...themeVars,
        background: `radial-gradient(circle_at_top, ${theme.colors.secondary}33, transparent 55%), linear-gradient(120deg, ${theme.colors.background}, ${theme.colors.surface})`,
        color: theme.colors.text,
      }}
    >
      <header className="relative overflow-hidden">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full blur-3xl" style={{ background: `${theme.colors.accent}55` }} />
        <div className="absolute -bottom-24 left-8 h-64 w-64 rounded-full blur-3xl" style={{ background: `${theme.colors.primary}33` }} />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-6 py-20">
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.4em]" style={{ color: theme.colors.secondary }}>
            <span>Client Portal</span>
            <span className="h-1 w-1 rounded-full" style={{ backgroundColor: theme.colors.secondary }} />
            <span>{profile.category}</span>
          </div>
          <h1 className="max-w-3xl font-mono text-4xl font-semibold md:text-5xl">
            {profile.name} — {profile.tagline}
          </h1>
          <p className="max-w-2xl text-lg" style={{ color: theme.colors.text }}>
            {profile.description}
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="#booking"
              className="rounded-full px-6 py-3 text-sm font-semibold shadow-lg"
              style={{
                backgroundColor: theme.colors.primary,
                color: theme.colors.text,
                boxShadow: `0 12px 24px ${theme.colors.primary}33`,
              }}
            >
              Reservar cita
            </a>
            <a
              href="#services"
              className="rounded-full border px-6 py-3 text-sm font-semibold"
              style={{ borderColor: theme.colors.secondary, color: theme.colors.text }}
            >
              Ver servicios y precios
            </a>
            {profile.whatsapp && (
              <a
                href={`https://wa.me/${profile.whatsapp.replace(/[^\d]/g, "")}`}
                className="rounded-full border px-6 py-3 text-sm font-semibold"
                style={{ borderColor: theme.colors.primary, color: theme.colors.text }}
              >
                Hablar por WhatsApp
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-6 pb-16">
        <section id="services" className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
          <div
            className="rounded-[32px] border p-6 shadow-xl"
            style={{ borderColor: theme.colors.secondary, backgroundColor: `${theme.colors.surface}cc` }}
          >
            <h2 className="text-2xl font-semibold">Servicios activos</h2>
            <p className="mt-2 text-sm" style={{ color: theme.colors.text }}>
              Precios claros y duración estimada para cada look.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {(topServices.length ? topServices : services).map((service) => (
                <div
                  key={service.id}
                  className="rounded-2xl border p-4"
                  style={{ borderColor: theme.colors.secondary, backgroundColor: `${theme.colors.background}80` }}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{service.name}</p>
                    <span className="text-sm" style={{ color: theme.colors.text }}>
                      {service.durationMinutes} min
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-semibold" style={{ color: theme.colors.primary }}>
                    {service.currentPrice.toFixed(2)} €
                  </p>
                </div>
              ))}
            </div>
            {services.length > 6 && (
              <p className="mt-4 text-xs uppercase tracking-[0.2em]" style={{ color: theme.colors.secondary }}>
                Ver todos los servicios en la reserva
              </p>
            )}
          </div>

          <div
            className="rounded-[32px] border p-6"
            style={{ borderColor: theme.colors.secondary, backgroundColor: `${theme.colors.surface}b3` }}
          >
            <h3 className="text-xl font-semibold">Confianza real</h3>
            <div className="mt-4 space-y-4 text-sm" style={{ color: theme.colors.text }}>
              {TRUST_POINTS.map((point) => (
                <div
                  key={point.title}
                  className="rounded-2xl border p-4"
                  style={{ borderColor: theme.colors.secondary, backgroundColor: `${theme.colors.background}80` }}
                >
                  <p className="font-semibold" style={{ color: theme.colors.primary }}>
                    {point.title}
                  </p>
                  <p className="mt-1">{point.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <div
            className="rounded-[32px] border p-6"
            style={{ borderColor: theme.colors.secondary, backgroundColor: `${theme.colors.surface}b3` }}
          >
            <h3 className="text-xl font-semibold">Historias de clientas</h3>
            <div className="mt-4 grid gap-4">
              {REVIEWS.map((review) => (
                <div
                  key={review.name}
                  className="rounded-2xl border p-4"
                  style={{ borderColor: theme.colors.secondary, backgroundColor: `${theme.colors.background}80` }}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{review.name}</p>
                    <span className="text-amber-500">{"★".repeat(review.rating)}</span>
                  </div>
                  <p className="mt-2 text-sm" style={{ color: theme.colors.text }}>
                    {review.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div
            className="rounded-[32px] border p-6"
            style={{ borderColor: theme.colors.secondary, backgroundColor: theme.colors.primary, color: theme.colors.text }}
          >
            <h3 className="text-xl font-semibold">Beneficios clave</h3>
            <p className="mt-3 text-sm" style={{ color: `${theme.colors.text}cc` }}>
              Equipo especializado, agenda flexible y productos premium para resultados consistentes.
            </p>
            <div className="mt-6 grid gap-3 text-xs uppercase tracking-[0.2em] text-white/70">
              <span>Agenda flexible</span>
              <span>Equipo especializado</span>
              <span>Productos profesionales</span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-[#2f1b13] px-4 py-3 text-xs text-[#2f1b13]">
            <p className="text-xs uppercase tracking-[0.2em]">Dominio</p>
            <p className="mt-1 text-sm font-semibold">{profile.primaryDomain ?? profile.publicSubdomain ?? "Sin configurar"}</p>
            <p className="text-xs text-[#6b4c3b]">Estado: {profile.domainStatus}</p>
          </div>
          <div className="rounded-[28px] border border-[#2f1b13] px-4 py-3 text-xs text-[#2f1b13]">
            <p className="text-xs uppercase tracking-[0.2em]">Ubicacion</p>
            <p className="mt-1 text-sm font-semibold">{profile.city ?? "Barcelona"}</p>
            <p className="text-xs text-[#6b4c3b]">{profile.address ?? "Passeig de Gracia 1"}</p>
          </div>
          <div className="rounded-[28px] border border-[#2f1b13] px-4 py-3 text-xs text-[#2f1b13]">
            <p className="text-xs uppercase tracking-[0.2em]">Redes sociales</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {profile.socialLinks.length > 0 ? (
                profile.socialLinks.map((link) => (
                  <a key={link.url} href={link.url} className="text-sm font-semibold text-[#2f1b13] underline">
                    {link.provider}
                  </a>
                ))
              ) : (
                <span className="text-xs text-[#6b4c3b]">Sin enlaces configurados</span>
              )}
            </div>
          </div>
        </section>

        <ExperienceSection saasId={profile.saasId} services={services} />
      </main>
    </div>
  );
}
