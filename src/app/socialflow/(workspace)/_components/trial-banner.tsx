import Link from "next/link";

export default function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const label =
    daysLeft === 0
      ? "Tu prueba termina hoy"
      : daysLeft === 1
      ? "Te queda 1 día de prueba gratuita"
      : `Te quedan ${daysLeft} días de prueba gratuita`;

  return (
    <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-violet-400" />
        <p className="text-sm font-semibold text-violet-200">{label}</p>
      </div>
      <Link
        href="/socialflow/settings/billing"
        className="shrink-0 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 px-3.5 py-1.5 text-xs font-black tracking-wide text-white shadow shadow-violet-500/30 transition hover:brightness-110"
      >
        Elegir plan
      </Link>
    </div>
  );
}
