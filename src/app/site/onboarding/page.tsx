import Link from "next/link";

export default function OnboardingIndexPage() {
  return (
    <div className="space-y-4 text-center text-white">
      <p className="text-xs uppercase tracking-[0.4em] text-white/50">Onboarding</p>
      <h1 className="text-3xl font-semibold">Completa los 3 pasos para lanzar tu SaaS</h1>
      <p className="text-sm text-white/70">Comienza por los datos de tu empresa y te guiaremos hasta la creación del SaaS dentro de DRĀKO BASE.</p>
      <div className="flex justify-center">
        <Link
          href="/site/onboarding/company"
          className="inline-flex items-center justify-center rounded-2xl bg-[var(--brand,#4cc9f0)] px-6 py-3 text-base font-semibold text-black shadow-[0_12px_30px_rgba(76,201,240,0.35)] transition hover:-translate-y-0.5"
        >
          Ir al paso 1
        </Link>
      </div>
    </div>
  );
}
