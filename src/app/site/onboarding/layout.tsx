"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const steps = [
  { label: "Empresa", href: "/site/onboarding/company" },
  { label: "SaaS", href: "/site/onboarding/saas" },
  { label: "Revisión", href: "/site/onboarding/review" },
];

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6 text-white">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_80px_rgba(3,5,11,0.6)]">
        <p className="text-xs uppercase tracking-[0.4em] text-white/40">Onboarding</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => {
            const isActive = pathname === step.href;
            const isCompleted = steps.findIndex((s) => s.href === pathname) > index;
            return (
              <Link
                key={step.href}
                href={step.href}
                className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition hover:border-cyan-400/60"
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    isActive
                      ? "bg-[var(--brand,#4cc9f0)] text-black"
                      : isCompleted
                      ? "bg-white/30 text-white"
                      : "bg-white/10 text-white/50"
                  }`}
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">Paso {index + 1}</p>
                  <p className={`text-sm font-semibold ${isActive ? "text-white" : "text-white/70"}`}>{step.label}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(3,5,11,0.55)]">{children}</div>
    </div>
  );
}
