import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { LOGO_HEADER_URL } from "@/app/socialflows/_components/landing-config";
import { LEGAL_COPYRIGHT } from "@/components/socialflow/legal/legal-data";
import "../auth.css";

// Marco común de la pantalla de acceso (login / registro) y de la recuperación de contraseña.
// Izquierda (o franja superior en tablet y móvil): el logo REAL de SocialCors (logo-cabecera.png en
// R2, tal cual, sin recortar ni deformar) y la propuesta "analiza, crea, publica y aprende por ti".
// Derecha: el contenido (la tarjeta de acceso) y los enlaces legales.
const STEPS = [
  { title: "Analiza", text: "Tus fotos, tu marca y tu audiencia." },
  { title: "Crea", text: "Texto, hashtags y formato adaptados a tu negocio." },
  { title: "Publica", text: "En el mejor momento, con tu aprobación." },
  { title: "Aprende", text: "De tus métricas para mejorar lo siguiente." },
] as const;

const LEGAL_ROW = [
  { label: "Aviso Legal", href: "/aviso-legal" },
  { label: "Privacidad", href: "/privacidad" },
  { label: "Cookies", href: "/cookies" },
  { label: "Términos", href: "/terminos" },
  { label: "Contacto", href: "/contacto" },
] as const;

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="sa-root">
      <div className="sa-grid">
        <aside className="sa-brand" aria-label="SocialCors">
          <div className="sa-brand-top">
            <Link href="/" className="sa-logo" aria-label="SocialCors — ir al inicio">
              {/* Logo oficial en Cloudflare R2, usado tal cual. La altura sale de su proporción (1536×1024). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={LOGO_HEADER_URL}
                alt="SocialCors"
                width={1536}
                height={1024}
                className="sa-logo-img"
                decoding="async"
                {...({ fetchpriority: "high" } as Record<string, string>)}
              />
            </Link>
            <div>
              <p className="sa-eyebrow"><i aria-hidden="true" />Tu Community Manager con IA</p>
              <p className="sa-statement">
                SocialCors <b>analiza, crea, publica y aprende</b> por ti.
              </p>
            </div>
          </div>

          <ol className="sa-steps" aria-label="Cómo trabaja SocialCors">
            <span className="sa-runner" aria-hidden="true" />
            {STEPS.map((step, i) => (
              <li key={step.title} className="sa-step" style={{ "--d": `${0.25 + i * 0.3}s` } as CSSProperties}>
                <span className="sa-node" aria-hidden="true" />
                <p className="sa-step-t">{step.title}</p>
                <p className="sa-step-d">{step.text}</p>
              </li>
            ))}
          </ol>

          <p className="sa-brand-foot">{LEGAL_COPYRIGHT}</p>
        </aside>

        <main className="sa-main">
          {children}
          <nav aria-label="Información legal" className="sa-links">
            {LEGAL_ROW.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
        </main>
      </div>
    </div>
  );
}
