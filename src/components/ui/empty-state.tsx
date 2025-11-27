import type { PropsWithChildren, ReactNode } from "react";

export default function EmptyState({ icon, title, subtitle, children }: PropsWithChildren<{ icon?: ReactNode; title: string; subtitle?: string }>) {
  return (
    <div className="card p-8 text-center">
      <div className="mx-auto mb-3 h-12 w-12 flex items-center justify-center rounded-lg bg-[var(--brand-quiet)] text-[var(--brand)]">
        {icon ?? (
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 12h6M12 9v6" />
          </svg>
        )}
      </div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      {subtitle && <p className="text-sm text-[var(--muted)] mb-4">{subtitle}</p>}
      {children}
    </div>
  );
}
