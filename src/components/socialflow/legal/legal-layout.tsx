// Copia de src/components/legal/legal-layout.tsx para SocialCors (P5). El holding conserva el original; no se comparten módulos.
// Layout común de las páginas legales de SocialCors: cabecera (logo + "Volver a SocialCors"),
// texto claro y legible (prose limpio, sin el diseño de cables y nodos del Home) y pie simple.
import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_COPYRIGHT, LEGAL_HOLDER, LEGAL_LINKS, LEGAL_LOGO_URL as LOGO_URL, LEGAL_UPDATED_LABEL } from "./legal-data";

export function LegalLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-slate-700">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5" aria-label="SocialCors — inicio">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_URL} alt="" width={36} height={36} className="h-9 w-9 object-contain" />
            <span className="text-lg font-black tracking-tight text-slate-900">SocialCors</span>
          </Link>
          <Link href="/" className="text-sm font-semibold text-indigo-700 hover:underline">
            ← Volver a SocialCors
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Última actualización: {LEGAL_UPDATED_LABEL}.</p>
        {intro && <div className="mt-6 space-y-3 text-[15px] leading-7">{intro}</div>}
        <div className="mt-10 space-y-10">{children}</div>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-3xl px-6 py-8">
          <nav aria-label="Documentos legales" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="font-medium text-slate-600 hover:text-indigo-700 hover:underline">
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="mt-4 text-xs text-slate-500">{LEGAL_COPYRIGHT}. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7">{children}</div>
    </section>
  );
}

export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5">{children}</ul>;
}

export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith("mailto:") || href.startsWith("http");
  return external ? (
    <a href={href} className="font-medium text-indigo-700 underline" {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  ) : (
    <Link href={href} className="font-medium text-indigo-700 underline">
      {children}
    </Link>
  );
}

export const emailHref = `mailto:${LEGAL_HOLDER.email}`;

/** Bloque de identificación del titular (Aviso Legal, Privacidad, DPA). */
export function LegalIdentity() {
  const rows: [string, ReactNode][] = [
    ["Titular", LEGAL_HOLDER.name],
    ["DNI", LEGAL_HOLDER.dni],
    ["Domicilio", LEGAL_HOLDER.address],
    ["Correo electrónico", <LegalLink key="e" href={emailHref}>{LEGAL_HOLDER.email}</LegalLink>],
    ["Sitio web", <LegalLink key="w" href={LEGAL_HOLDER.webUrl}>{LEGAL_HOLDER.web}</LegalLink>],
  ];
  return (
    <dl className="divide-y divide-slate-200 rounded-xl border border-slate-200 text-[15px]">
      {rows.map(([k, v]) => (
        <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <dt className="font-semibold text-slate-900">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
