import { notFound } from "next/navigation";
import Link from "next/link";
import LeadCaptureForm from "./lead-form";
import { getPublicClinicSiteData } from "@/lib/site/clinic";

/**
 * Cuando public_domain esté configurado y validado, este layout será el que
 * se exponga detrás del dominio personalizado gestionado en Cloudflare.
 */

type PublicClinicPageProps = {
  params?: Promise<{ slug: string }>;
};

export const runtime = "edge";

export default async function PublicClinicPage({ params }: PublicClinicPageProps) {
  const resolvedParams = params ? await params : { slug: "" };
  const data = await getPublicClinicSiteData(resolvedParams.slug);
  if (!data) return notFound();

  const profile = data.profile;
  const services = data.services.filter((service) => service.isActive);
  const heroSubtitle = profile?.primaryGoal === "loyalty" ? "Fidelización premium" : "Agenda llena sin caos";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#04050a] via-[#070d1a] to-[#0a0e1c] text-white">
      <header className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-16 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-white/60">Drako Clinic Network</p>
        <h1 className="text-4xl font-semibold lg:text-5xl">{profile?.displayName ?? data.name}</h1>
        <p className="text-xl text-white/80">{profile?.city ? `${profile.city} · ${heroSubtitle}` : heroSubtitle}</p>
        <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-white/70">
          <span>{profile?.roomsCount ?? 3} cabinas</span>
          <span className="h-1 w-1 rounded-full bg-white/40" />
          <span>{profile?.staffCount ?? 5} especialistas</span>
          <span className="h-1 w-1 rounded-full bg-white/40" />
          <span>Domina canales digitales con Drako</span>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/"
            className="rounded-full border border-white/40 px-6 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Conoce Drako
          </Link>
          <a
            href="#reserva"
            className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-black hover:bg-white/80"
          >
            Reserva tu cita
          </a>
        </div>
      </header>

      <section className="mx-auto grid max-w-5xl gap-8 px-6 pb-16 md:grid-cols-2" id="reserva">
        <div className="rounded-3xl border border-white/15 bg-white/5 p-6">
          <h2 className="text-2xl font-semibold">Servicios destacados</h2>
          <p className="mt-2 text-sm text-white/70">Resultados medibles, precios claros y agenda inteligente.</p>
          <div className="mt-6 flex flex-col gap-4">
            {(services.length ? services : data.services.slice(0, 3)).map((service) => (
              <div key={service.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-medium">{service.name}</p>
                  <p className="text-white/80">{(service.basePrice / 100).toFixed(2)} €</p>
                </div>
                <p className="text-xs text-white/60">
                  {service.durationMinutes} minutos · acompaña un especialista Drako Partner
                </p>
              </div>
            ))}
          </div>
        </div>
        <LeadCaptureForm slug={data.slug} services={services.length ? services : data.services} />
      </section>

      {data.reviews.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 pb-16">
          <h3 className="text-xl font-semibold">Historias reales</h3>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {data.reviews.slice(0, 3).map((review) => (
              <div key={review.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-lg font-semibold">{review.patientName}</p>
                <p className="text-sm text-amber-300">{Array.from({ length: review.rating }).map(() => "★").join("")}</p>
                <p className="mt-2 text-sm text-white/80">{review.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="border-t border-white/10 bg-black/40 py-8 text-center text-sm text-white/60">
        <p>
          © {new Date().getFullYear()} {profile?.displayName ?? data.name}. Powered by Drako Clinic Pack.
        </p>
        <p className="mt-1 text-xs">state: {data.domainStatus}</p>
      </footer>
    </div>
  );
}
