type Props = {
  ctaHref?: string;
  className?: string;
};

export function ClinicNoSubscriptionState({ ctaHref = "/billing", className }: Props) {
  return (
    <div
      className={[
        "rounded-3xl border border-[var(--border)] bg-[var(--panel)]/70 p-8 text-center",
        className ?? "",
      ].join(" ")}
    >
      <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Drako Clinic</p>
      <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Activa Drako Clinic para usar este panel</h2>
      <p className="mt-3 text-sm text-[var(--muted)]">
        Desde Campamento Base añade el pack Drako Clinic Starter a este cliente para desbloquear leads, agenda y finanzas.
      </p>
      <a
        href={ctaHref}
        className="mt-6 inline-flex items-center justify-center rounded-full bg-[var(--brand)] px-6 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-strong)]"
      >
        Ir a billing
      </a>
    </div>
  );
}
