import Link from "next/link";
import type { ReactNode } from "react";
import { HeroSystem } from "./hero-system";
import LiveZone from "./live-zone";
import Reveal from "./reveal";
import { LEGAL_COPYRIGHT } from "@/components/legal/legal-data";
import { CoreDisc, SysHead, Wires, vars, type WirePath } from "./flow";
import {
  DEMO_VIDEO_URL,
  FAQ,
  HEADLINE,
  HREF_LOGIN,
  HREF_PLANS,
  HREF_START,
  LOGO_HEADER_URL,
  LOGO_URL,
  SUBHEADLINE,
  TRIAL_DAYS,
} from "./landing-config";
import {
  AppWindow,
  FormField,
  GeneratedPost,
  IcoCamera,
  IcoCheck,
  InteractionPill,
  PhotoTile,
} from "./product-ui";

// ── Cadena de nodos (recorrido horizontal en escritorio, vertical en móvil) ─────
function Chain({
  items,
  tone = "light",
  className = "",
  label,
}: {
  items: string[];
  tone?: "light" | "dark";
  className?: string;
  label: string;
}) {
  return (
    <ol className={`sy-chain sy-${tone} ${className}`} aria-label={label}>
      {items.map((item, i) => (
        <li key={item} className="sy-chain-item" style={vars({ "--nd": `${0.3 + i * 0.35}s` })}>
          <span className="sy-chain-node" aria-hidden="true" />
          <span className="sy-chain-label">{item}</span>
        </li>
      ))}
    </ol>
  );
}

// ── NAV ─────────────────────────────────────────────────────────────────────
export function LandingNav() {
  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md"
      style={{ background: "rgba(247,246,250,0.86)", borderColor: "var(--sc-line)" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="SocialCors — inicio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_URL} alt="" width={36} height={36} className="h-9 w-9 object-contain" />
          <span className="sc-ink text-lg font-black tracking-tight">SocialCors</span>
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-1 sm:gap-2">
          <a href="#como-funciona" className="sc-muted hidden rounded-lg px-3 py-2 text-sm font-semibold hover:text-[var(--sc-ink)] md:block">
            Cómo funciona
          </a>
          <Link href={HREF_PLANS} className="sc-muted hidden rounded-lg px-3 py-2 text-sm font-semibold hover:text-[var(--sc-ink)] md:block">
            Planes
          </Link>
          <Link href={HREF_LOGIN} className="sc-muted hidden rounded-lg px-3 py-2 text-sm font-semibold hover:text-[var(--sc-ink)] sm:block">
            Iniciar sesión
          </Link>
          <Link href={HREF_START} className="sc-btn !px-4 !py-2 !text-sm">
            Probar SocialCors
          </Link>
        </nav>
      </div>
    </header>
  );
}

// ── HERO ────────────────────────────────────────────────────────────────────
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="px-4 pb-4 pt-6 sm:px-6 md:pt-10">
      <div className="mx-auto max-w-5xl text-center">
        <p className="sc-eyebrow">Para autónomos, profesionales y pequeños negocios</p>
        <h1
          id="hero-title"
          className="sc-ink mt-4 text-[2.5rem] font-black leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-[4.25rem]"
        >
          Tú haces la foto.
          <br />
          <span className="sc-accent">SocialCors hace el resto.</span>
        </h1>
        <p className="sc-muted mx-auto mt-5 max-w-2xl text-base leading-relaxed sm:text-lg">{SUBHEADLINE}</p>
        <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={HREF_START} className="sc-btn w-full sm:w-auto">
            Probar SocialCors
          </Link>
          <a href="#como-funciona" className="sc-btn-ghost w-full sm:w-auto">
            Ver cómo funciona
          </a>
        </div>
        <p className="sc-muted mt-4 text-sm">
          {TRIAL_DAYS} días gratis · Sin tarjeta · Cancela cuando quieras
        </p>
      </div>

      <HeroSystem />

      <p className="sc-ink mx-auto mt-8 max-w-2xl text-center text-base font-bold md:text-lg">
        Menos tiempo creando contenido. Más tiempo haciendo crecer tu negocio.
      </p>
    </section>
  );
}

// ── CÓMO FUNCIONA: un recorrido, no cuatro tarjetas ─────────────────────────
function StepAccount() {
  return (
    <AppWindow title="Crear cuenta">
      <div className="flex flex-col gap-2.5 p-3">
        <FormField label="Nombre" />
        <FormField label="Email" />
        <FormField label="Contraseña" value="••••••••" />
        <span className="sc-app-btn mt-1 !py-1.5">Crear cuenta</span>
      </div>
    </AppWindow>
  );
}

function StepProfile() {
  return (
    <AppWindow title="Mi Perfil · Base de conocimiento">
      <div className="flex flex-col gap-2.5 p-3">
        <FormField label="Nombre de marca" />
        <FormField label="Tono de comunicación" />
        <span className="sc-app-label pt-1">Base de conocimiento</span>
        <div className="flex flex-wrap gap-1.5">
          {["PDF", "URL", "Catálogo", "Competidor"].map((t) => (
            <span key={t} className="sc-app-chip">{t}</span>
          ))}
        </div>
      </div>
    </AppWindow>
  );
}

function StepUpload() {
  return (
    <AppWindow title="Analizar y publicar con IA">
      <div className="p-3">
        <div
          className="flex h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center"
          style={{ borderColor: "rgba(167,139,250,0.45)", background: "rgba(139,92,246,0.06)" }}
        >
          <span className="block h-6 w-6 [&>svg]:h-full [&>svg]:w-full" style={{ color: "#c4b5fd" }}>
            <IcoCamera />
          </span>
          <span className="text-[0.6875rem] font-semibold" style={{ color: "var(--sc-app-text)" }}>
            Sube tus fotos o vídeos
          </span>
        </div>
      </div>
    </AppWindow>
  );
}

function StepResult() {
  return (
    <AppWindow title="Analizar y publicar con IA">
      <div className="p-3">
        <GeneratedPost compact />
      </div>
    </AppWindow>
  );
}

const STEPS: { n: string; title: string; text: string; visual: ReactNode }[] = [
  { n: "01", title: "Crea tu cuenta", text: "Configura SocialCors y prepara tu espacio de trabajo.", visual: <StepAccount /> },
  {
    n: "02",
    title: "Cuéntale quién eres",
    text: "Completa tu perfil y tu Base de conocimiento para que SocialCors entienda tu negocio.",
    visual: <StepProfile />,
  },
  { n: "03", title: "Sube una foto o vídeo", text: "No necesitas empezar desde cero. Tú aportas el contenido.", visual: <StepUpload /> },
  {
    n: "04",
    title: "SocialCors hace el resto",
    text: "Utiliza el contexto disponible para ayudarte a crear contenido adaptado a tu negocio.",
    visual: <StepResult />,
  },
];

export function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="how-title" className="sy-band px-4 py-8 sm:px-6 md:py-12">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SysHead eyebrow="Cómo funciona" titleId="how-title" title="De una foto a contenido listo para tus redes." />
        </Reveal>
        <LiveZone className="sy-jour-wrap mt-8">
          <Reveal className="sy-jour">
            <span className="sy-jline" aria-hidden="true" />
            <span className="sy-jdot" aria-hidden="true" />
            <ol className="sy-jol">
              {STEPS.map((step, i) => (
                <li key={step.n} className="sy-jstep" style={vars({ "--nd": `${0.3 + i * 0.32}s` })}>
                  <span className="sy-jnode">{step.n}</span>
                  <span className="sy-jstem" aria-hidden="true" />
                  <div className="sy-jbody">
                    <h3 className="sy-jt">{step.title}</h3>
                    <p className="sy-jp">{step.text}</p>
                    <div className="sy-jui">{step.visual}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </LiveZone>
        <p className="sc-muted mt-8 text-center text-xs">Ilustraciones de la interfaz de SocialCors.</p>
      </div>
    </section>
  );
}

// ── EN TIEMPO REAL ──────────────────────────────────────────────────────────
// El "00:00" es solo visual (no es un cronómetro funcional): la duración real llegará con los
// vídeos de demostración. NO inventar tiempos.
export function RealTime() {
  return (
    <section id="tiempo-real" aria-labelledby="realtime-title" className="px-4 py-4 sm:px-6 md:py-6">
      <Reveal className="mx-auto max-w-6xl">
        <div className="sy-dpanel grid items-center gap-8 rounded-3xl px-6 py-8 md:grid-cols-[1fr_1.05fr] md:px-12 md:py-10">
          <div>
            <SysHead
              align="left"
              dark
              eyebrow="En tiempo real"
              titleId="realtime-title"
              title="No te lo contamos. Te lo enseñamos."
            >
              Mira cuánto tardas realmente en poner SocialCors en marcha.
            </SysHead>
            <div className="mt-7">
              {DEMO_VIDEO_URL ? (
                <a href={DEMO_VIDEO_URL} className="sc-btn-light" target="_blank" rel="noopener noreferrer">
                  Ver la demostración
                </a>
              ) : (
                <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.55)" }}>
                  Vídeos de demostración con cronómetro real: próximamente.
                </p>
              )}
            </div>
          </div>

          <div className="sy-rt">
            <AppWindow title="Crear cuenta · cronómetro">
              <div className="sy-rt-body">
                <div className="sy-rt-clock">
                  <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                    <circle cx="50" cy="50" r="45" className="sy-rt-ring" />
                    <circle cx="50" cy="5" r="3.4" className="sy-rt-tick" />
                  </svg>
                  <span className="sc-stopwatch sy-rt-time">00:00</span>
                </div>
                <ol className="sy-rt-form sc-onview">
                  {["Nombre", "Email", "Contraseña"].map((label, i) => (
                    <li key={label} className="sy-rt-field">
                      <span className="sy-rt-fnode" aria-hidden="true" />
                      <div className="flex-1">
                        <span className="sc-app-label">{label}</span>
                        <div className="sc-app-field !px-0">
                          <div
                            className="sc-bar-fill sc-grow-view mx-2"
                            style={{ ...vars({ "--d": `${0.2 + i * 0.5}s`, "--w": `${[58, 74, 42][i]}%` }), height: "0.3rem" }}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                  <li className="sy-rt-field">
                    <span className="sy-rt-fnode sy-rt-fnode--end" aria-hidden="true" />
                    <span className="sc-app-btn !py-1.5 flex-1">Crear cuenta</span>
                  </li>
                </ol>
              </div>
            </AppWindow>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ── LA TRANSFORMACIÓN: contenido bruto → SocialCors → contenido preparado ───
export function BeforeAfter() {
  return (
    <section id="antes-despues" aria-labelledby="transform-title" className="sy-band px-4 py-8 sm:px-6 md:py-12">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SysHead
            eyebrow="La transformación"
            titleId="transform-title"
            title="De «¿y ahora qué publico?» a contenido preparado."
          />
        </Reveal>

        <LiveZone className="sy-tf mt-7">
          <Reveal className="sy-tf-grid">
            <div className="sy-tf-side">
              <p className="sy-tf-tag">Antes · Contenido bruto</p>
              <div className="sy-tf-before">
                <PhotoTile className="h-40" />
                <p className="sy-tf-quote">«Tengo esta foto… ¿y ahora qué publico?»</p>
              </div>
            </div>

            <div className="sy-tf-mid" aria-hidden="true">
              <span className="sy-tf-link" />
              <CoreDisc className="sy-core--tf" />
              <span className="sy-tf-link" />
            </div>

            <div className="sy-tf-side">
              <p className="sy-tf-tag sy-tf-tag--on">Después · Contenido preparado</p>
              <div className="relative">
                <AppWindow title="Analizar y publicar con IA">
                  <div className="p-3 sm:p-4">
                    <GeneratedPost />
                  </div>
                </AppWindow>
                {/* Señales de interacción: 4 iconos, sin cifras, aparecen y se desvanecen despacio */}
                <InteractionPill kind="heart" className="-right-2 top-20" delay={0} />
                <InteractionPill kind="comment" className="-left-2 top-[42%]" delay={1.1} />
                <InteractionPill kind="eye" className="-right-2 top-[62%]" delay={2.2} />
                <InteractionPill kind="trend" className="-left-2 bottom-16" delay={3.3} />
              </div>
              <p className="sc-muted mt-3 text-xs">
                Ejemplo ilustrativo de la interfaz de SocialCors. Las interacciones dependen de tu audiencia.
              </p>
            </div>
          </Reveal>
          <Chain
            label="Qué hace SocialCors con tu foto"
            className="sy-chain--tf"
            items={["Foto", "Texto", "Hashtags", "Formato", "Contenido preparado"]}
          />
        </LiveZone>
      </div>
    </section>
  );
}

// ── TU NEGOCIO YA TE OCUPA SUFICIENTE TIEMPO ────────────────────────────────
export function YourTime() {
  return (
    <section aria-labelledby="time-title" className="sy-band sy-band--flat px-4 pb-10 pt-4 sm:px-6 md:pb-14">
      <Reveal className="mx-auto max-w-3xl text-center">
        <span className="sy-quote-node" aria-hidden="true" />
        <h2 id="time-title" className="sc-ink text-3xl font-black leading-[1.1] tracking-tight md:text-5xl">
          Tu negocio ya te ocupa suficiente tiempo.
        </h2>
        <p className="sc-muted mt-5 text-lg leading-relaxed md:text-xl">
          Crear contenido para tus redes no debería convertirse en otro trabajo.
        </p>
        <p className="sc-ink mt-4 text-lg font-bold md:text-xl">
          SocialCors está diseñado para quitarte parte de ese trabajo.
        </p>
      </Reveal>
    </section>
  );
}

// ── DEMOSTRACIÓN ────────────────────────────────────────────────────────────
const DEMO_FLOW = ["Cuenta", "Perfil", "Base de conocimiento", "Subir contenido", "IA", "Resultado", "Calendario"];

export function Demo() {
  return (
    <section id="demo" aria-labelledby="demo-title" className="px-4 py-6 sm:px-6 md:py-10">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SysHead titleId="demo-title" title="Mira SocialCors en acción." />
        </Reveal>
        <Reveal delay={0.08} className="mt-10">
          {DEMO_VIDEO_URL ? (
            <video
              className="aspect-video w-full rounded-2xl bg-black"
              controls
              playsInline
              preload="metadata"
              src={DEMO_VIDEO_URL}
              aria-label="Demostración de SocialCors"
            />
          ) : (
            <LiveZone className="sc-app sy-demo">
              <Chain label="Recorrido de la demostración" tone="dark" items={DEMO_FLOW} className="sy-chain--demo" />
              <p className="mt-8 text-center text-sm font-semibold" style={{ color: "var(--sc-app-muted)" }}>
                Demostración en vídeo: próximamente.
              </p>
            </LiveZone>
          )}
        </Reveal>
      </div>
    </section>
  );
}

// ── PRUEBA GRATUITA → PLANES: un solo recorrido ─────────────────────────────
export function TrialAndPlans() {
  return (
    <section aria-labelledby="trial-title" className="px-4 py-5 sm:px-6 md:py-8">
      <Reveal className="mx-auto max-w-5xl">
        <div className="sy-tp">
          <div className="sy-tp-a">
            <p className="sc-eyebrow">Prueba gratuita</p>
            <h2 id="trial-title" className="sc-ink mt-3 text-3xl font-black leading-[1.1] tracking-tight">
              {TRIAL_DAYS} días gratis para probarlo.
            </h2>
            <ul className="mt-5 flex flex-col gap-2 text-sm font-semibold">
              {["Sin tarjeta de crédito", "Cancela cuando quieras"].map((item) => (
                <li key={item} className="sc-ink flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-5 items-center justify-center rounded-full text-white"
                    style={{ background: "var(--sc-accent)" }}
                  >
                    <IcoCheck />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href={HREF_START} className="sc-btn mt-6">
              Empieza a probar SocialCors
            </Link>
          </div>

          <div className="sy-tp-join" aria-hidden="true">
            <span className="sy-tp-line" />
            <span className="sy-tp-node" />
            <span className="sy-tp-line" />
          </div>

          <div className="sy-tp-b">
            <p className="sc-eyebrow">Planes</p>
            <h2 className="sc-ink mt-3 text-3xl font-black leading-[1.1] tracking-tight">Empieza con SocialCors</h2>
            <p className="sc-muted mt-4 text-base leading-relaxed">
              Elige el plan que mejor se adapta a la cantidad de contenido que necesitas crear.
            </p>
            <Link href={HREF_PLANS} className="sc-btn-ghost mt-6">
              Ver planes
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ── FAQ: hilo con un nodo por pregunta ──────────────────────────────────────
export function Faq() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section id="faq" aria-labelledby="faq-title" className="sy-band px-4 py-8 sm:px-6 md:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <SysHead eyebrow="Preguntas frecuentes" titleId="faq-title" title="Lo que suele preguntarse antes de empezar." />
        </Reveal>
        <Reveal className="sy-fq mt-10">
          {FAQ.map((item) => (
            <details key={item.q} className="sy-fq-item">
              <summary>
                <span className="sy-fq-node" aria-hidden="true" />
                <h3 className="sy-fq-q">{item.q}</h3>
                <svg className="sy-fq-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </summary>
              <p className="sy-fq-a">{item.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

// ── CTA FINAL: todo converge en la acción ───────────────────────────────────
const FW = 1000;
const FH = 440;
// Los cables convergen en el botón (centrado, ~70 % de la altura) sin cruzar el texto.
const FINAL_PATHS: WirePath[] = [
  { d: "M30 270 C 200 270 290 312 392 312", fd: 0.4, draw: 0.1 },
  { d: "M30 372 C 200 372 300 312 392 312", fd: 1.2, draw: 0.2 },
  { d: "M970 270 C 800 270 710 312 608 312", fd: 0.8, draw: 0.15 },
  { d: "M970 372 C 800 372 700 312 608 312", fd: 1.6, draw: 0.25 },
];

export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="px-4 py-5 sm:px-6 md:py-8">
      <Reveal className="mx-auto max-w-5xl">
        <LiveZone className="sy-final">
          <div className="sy-final-wires" aria-hidden="true">
            <Wires w={FW} h={FH} paths={FINAL_PATHS} tone="dark" />
          </div>
          <div className="sy-final-body">
            <h2 id="final-title" className="text-4xl font-black leading-[1.05] tracking-tight text-white md:text-6xl">
              Deja de pensar qué publicar.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed md:text-lg" style={{ color: "rgba(255,255,255,0.78)" }}>
              Tú conoces tu negocio. SocialCors te ayuda a convertirlo en contenido.
            </p>
            <div className="mt-8">
              <Link href={HREF_START} className="sc-btn-light">
                Probar SocialCors
              </Link>
            </div>
            <p className="mt-8 text-sm font-bold tracking-wide" style={{ color: "rgba(255,255,255,0.6)" }}>
              {HEADLINE}
            </p>
          </div>
        </LiveZone>
      </Reveal>
    </section>
  );
}

// ── FOOTER: cierra el recorrido ─────────────────────────────────────────────
export function LandingFooter() {
  // Grupos de enlaces del pie. "Contacto" apunta a /contacto (página propia de SocialCors); /contact
  // es la página de Drako Systems y NO debe enlazarse desde aquí.
  const groups = [
    {
      title: "Producto",
      links: [
        { label: "Planes", href: HREF_PLANS },
        { label: "Iniciar sesión", href: HREF_LOGIN },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Aviso Legal", href: "/aviso-legal" },
        { label: "Privacidad", href: "/privacidad" },
        { label: "Cookies", href: "/cookies" },
        { label: "Términos", href: "/terminos" },
        { label: "DPA", href: "/dpa" },
      ],
    },
    {
      title: "Contacto",
      links: [{ label: "Contacto", href: "/contacto" }],
    },
  ];
  return (
    <footer className="px-4 pb-10 pt-2 sm:px-6">
      <Reveal className="mx-auto max-w-6xl">
        <LiveZone className="sy-foot">
          <div className="sy-foot-logo">
            {/* Logo de cabecera tal cual (1536×1024, fondo propio): sin recortar ni redibujar */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_HEADER_URL} alt="SocialCors" width={1536} height={1024} loading="lazy" decoding="async" />
          </div>
          <div className="sy-foot-main">
            <p className="sy-foot-kicker">El sistema, de principio a fin</p>
            <Chain
              label="El recorrido completo"
              tone="dark"
              className="sy-chain--foot"
              items={["SocialCors", "Tu negocio", "Tu contenido", "Tus redes", "Tu evolución"]}
            />
            <div className="sy-foot-links">
              {groups.map((g) => (
                <nav key={g.title} aria-label={g.title}>
                  <p className="sy-foot-h">{g.title}</p>
                  <ul className="sy-foot-ul">
                    {g.links.map((l) => (
                      <li key={l.label}>
                        <Link href={l.href} className="sy-foot-link">
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
            <div className="sy-foot-bottom">
              <p className="sy-foot-copy">{LEGAL_COPYRIGHT}. Todos los derechos reservados.</p>
            </div>
          </div>
        </LiveZone>
      </Reveal>
    </footer>
  );
}
