import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import Reveal from "./reveal";
import {
  AVAILABLE_NETWORKS,
  DEMO_VIDEO_URL,
  FAQ,
  HEADLINE,
  HREF_LOGIN,
  HREF_PLANS,
  HREF_START,
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
  MiniCalendar,
  PhotoTile,
  SAMPLE,
  StageLabel,
} from "./product-ui";

// Variables CSS (--d = retardo de animación, --w = ancho final de barra) tipadas para style.
const vars = (v: Record<string, string>) => v as unknown as CSSProperties;
const delay = (seconds: number) => vars({ "--d": `${seconds}s` });

function SectionHead({
  eyebrow,
  title,
  children,
  align = "center",
}: {
  eyebrow?: string;
  title: ReactNode;
  children?: ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      {eyebrow && <p className="sc-eyebrow">{eyebrow}</p>}
      <h2 className="sc-ink mt-3 text-3xl font-black leading-[1.1] tracking-tight md:text-4xl">{title}</h2>
      {children && <p className="sc-muted mt-4 text-base leading-relaxed md:text-lg">{children}</p>}
    </div>
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
function HeroProduct() {
  return (
    <div className="mx-auto mt-12 max-w-5xl md:mt-14">
      <AppWindow title="SocialCors · Analizar y publicar con IA">
        <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4">
          {/* 1 — Foto subida */}
          <div className="sc-app-card sc-rise p-3" style={delay(0.1)}>
            <StageLabel n={1}>Subes tu foto</StageLabel>
            <PhotoTile className="h-24" />
            <div className="mt-3 flex items-center justify-between text-[0.625rem]" style={{ color: "var(--sc-app-muted)" }}>
              <span>Foto subida</span>
              <span>100%</span>
            </div>
            <div className="sc-bar-track mt-1.5">
              <div className="sc-bar-fill sc-grow" style={vars({ "--d": "0.4s", "--w": "100%" })} />
            </div>
          </div>

          {/* 2 — Análisis */}
          <div className="sc-app-card sc-rise p-3" style={delay(0.7)}>
            <StageLabel n={2}>Analiza</StageLabel>
            <ul className="flex flex-col gap-2.5 pt-1">
              {[
                { label: "Personas", d: 1.0 },
                { label: "Lugar", d: 1.25 },
                { label: "Producto", d: 1.5 },
              ].map(({ label, d }) => (
                <li key={label} className="flex items-center gap-2 text-[0.6875rem]" style={{ color: "var(--sc-app-text)" }}>
                  <span
                    className="sc-fade flex h-4 w-4 items-center justify-center rounded-full text-white"
                    style={{ ...delay(d), background: "var(--sc-accent-soft)" }}
                  >
                    <IcoCheck />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
            <p className="sc-fade mt-4 text-[0.625rem] leading-relaxed" style={{ ...delay(1.7), color: "var(--sc-app-muted)" }}>
              Cruza la foto con el perfil y la Base de conocimiento de tu negocio.
            </p>
          </div>

          {/* 3 — Contenido generado */}
          <div className="sc-app-card sc-rise p-3" style={delay(1.5)}>
            <StageLabel n={3}>Genera el contenido</StageLabel>
            <div className="sc-fade flex flex-col gap-2" style={delay(1.9)}>
              <p className="text-[0.6875rem] leading-relaxed" style={{ color: "var(--sc-app-text)" }}>
                {SAMPLE.caption}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE.hashtags.map((h) => (
                  <span key={h} className="sc-app-chip">{h}</span>
                ))}
              </div>
              <div className="flex gap-1.5">
                <span className="sc-app-chip" data-on="true">Post</span>
                <span className="sc-app-chip">Reel</span>
                <span className="sc-app-chip">Historia</span>
              </div>
            </div>
          </div>

          {/* 4 — Calendario */}
          <div className="sc-app-card sc-rise p-3" style={delay(2.2)}>
            <StageLabel n={4}>Lo programa</StageLabel>
            <MiniCalendar animated />
            <div className="sc-fade mt-3 flex items-center justify-between gap-2" style={delay(2.9)}>
              <span className="sc-app-label">{SAMPLE.slot}</span>
              <span className="sc-app-btn">
                <IcoCheck /> Aprobar
              </span>
            </div>
          </div>
        </div>
      </AppWindow>
      <p className="sc-muted mt-3 text-center text-xs">
        Ejemplo ilustrativo de la interfaz de SocialCors: foto → análisis → contenido → calendario.
      </p>
    </div>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="px-4 pb-6 pt-12 sm:px-6 md:pt-20">
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
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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

      <HeroProduct />

      <p className="sc-ink mx-auto mt-8 max-w-2xl text-center text-base font-bold md:text-lg">
        Menos tiempo creando contenido. Más tiempo haciendo crecer tu negocio.
      </p>
    </section>
  );
}

// ── CÓMO FUNCIONA ───────────────────────────────────────────────────────────
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
    <section id="como-funciona" aria-labelledby="how-title" className="px-4 py-16 sm:px-6 md:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHead eyebrow="Cómo funciona" title={<span id="how-title">De una foto a contenido listo para tus redes.</span>} />
        </Reveal>
        <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.n} className="flex">
              <Reveal delay={i * 0.07} className="sc-card flex w-full flex-col gap-4 p-5">
                <div>
                  <span className="sc-accent text-sm font-black tracking-widest">{step.n}</span>
                  <h3 className="sc-ink mt-1 text-lg font-black leading-snug">{step.title}</h3>
                  <p className="sc-muted mt-2 text-sm leading-relaxed">{step.text}</p>
                </div>
                <div>{step.visual}</div>
              </Reveal>
            </li>
          ))}
        </ol>
        <p className="sc-muted mt-4 text-center text-xs">Ilustraciones de la interfaz de SocialCors.</p>
      </div>
    </section>
  );
}

// ── EN TIEMPO REAL ──────────────────────────────────────────────────────────
export function RealTime() {
  return (
    <section id="tiempo-real" aria-labelledby="realtime-title" className="px-4 py-8 sm:px-6 md:py-12">
      <Reveal className="mx-auto max-w-6xl">
        <div
          className="grid items-center gap-10 rounded-3xl px-6 py-12 md:grid-cols-2 md:px-12 md:py-14"
          style={{ background: "var(--sc-app-bg)" }}
        >
          <div>
            <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: "#a5b4fc" }}>
              En tiempo real
            </p>
            <h2 id="realtime-title" className="mt-3 text-3xl font-black leading-[1.1] tracking-tight text-white md:text-4xl">
              No te lo contamos. Te lo enseñamos.
            </h2>
            <p className="mt-4 text-base leading-relaxed md:text-lg" style={{ color: "rgba(255,255,255,0.7)" }}>
              Mira cuánto tardas realmente en poner SocialCors en marcha.
            </p>
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

          <AppWindow title="Crear cuenta · cronómetro">
            <div className="flex flex-col gap-4 p-4">
              <div className="flex items-baseline justify-between">
                <span className="sc-app-label">Cronómetro</span>
                <span className="sc-stopwatch text-4xl font-black text-white md:text-5xl">00:00</span>
              </div>
              {["Nombre", "Email", "Contraseña"].map((label, i) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <span className="sc-app-label">{label}</span>
                  <div className="sc-app-field !px-0">
                    <div
                      className="sc-bar-fill sc-grow-view mx-2"
                      style={{ ...vars({ "--d": `${0.2 + i * 0.5}s`, "--w": `${[58, 74, 42][i]}%` }), height: "0.3rem" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </AppWindow>
        </div>
      </Reveal>
    </section>
  );
}

// ── SOCIALCORS CONOCE TU NEGOCIO ────────────────────────────────────────────
// Cada categoría existe hoy en el producto (Mi Perfil / Base de conocimiento).
const KNOWLEDGE: { title: string; text: string; where: string }[] = [
  { title: "Tu negocio", text: "Nombre de marca, descripción, misión y propuesta de valor.", where: "Mi Perfil" },
  { title: "Tono de comunicación", text: "Cómo hablas y qué personalidad tiene tu marca.", where: "Mi Perfil" },
  { title: "Tu público", text: "Rango de edad, mercados objetivo y estilo visual.", where: "Mi Perfil" },
  { title: "Tu web", text: "Añade una URL y SocialCors lee su contenido.", where: "Base de conocimiento" },
  { title: "Documentación", text: "Sube PDFs con información relevante de tu negocio.", where: "Base de conocimiento" },
  { title: "Productos y servicios", text: "Catálogo en CSV o Excel (cuentas de empresa).", where: "Base de conocimiento" },
  { title: "Competidores", text: "Analiza a los competidores que tú indiques.", where: "Base de conocimiento" },
];

export function KnowsYourBusiness() {
  return (
    <section id="conocimiento" aria-labelledby="knowledge-title" className="px-4 py-16 sm:px-6 md:py-20">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <Reveal>
          <SectionHead
            align="left"
            eyebrow="SocialCors conoce tu negocio"
            title={<span id="knowledge-title">Cuanto más conoce tu negocio, mejor puede ayudarte.</span>}
          >
            Tú aportas la información que quieras. SocialCors la usa como contexto al crear cada pieza.
          </SectionHead>
          <p className="sc-ink mt-6 text-xl font-black leading-snug md:text-2xl">Contenido que tiene contexto.</p>
        </Reveal>

        <ul className="grid gap-3 sm:grid-cols-2">
          {KNOWLEDGE.map((item, i) => (
            <li key={item.title} className={i === KNOWLEDGE.length - 1 ? "sm:col-span-2" : ""}>
              <Reveal delay={i * 0.05} className="sc-card h-full p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="sc-ink text-base font-black">{item.title}</h3>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] font-bold"
                    style={{ background: "var(--sc-accent-quiet)", color: "var(--sc-accent)" }}
                  >
                    {item.where}
                  </span>
                </div>
                <p className="sc-muted mt-1.5 text-sm leading-relaxed">{item.text}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── ANTES / DESPUÉS ─────────────────────────────────────────────────────────
const TRANSFORM_CHAIN = ["Foto", "Texto", "Hashtags", "Formato", "Contenido preparado"];

export function BeforeAfter() {
  return (
    <section id="antes-despues" aria-labelledby="transform-title" className="px-4 py-16 sm:px-6 md:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHead
            eyebrow="La transformación"
            title={<span id="transform-title">De «¿y ahora qué publico?» a contenido preparado.</span>}
          />
        </Reveal>

        <div className="mt-12 grid items-center gap-6 lg:grid-cols-[minmax(0,4fr)_auto_minmax(0,5fr)]">
          <Reveal className="sc-card p-5">
            <p className="sc-eyebrow" style={{ color: "var(--sc-muted)" }}>Antes</p>
            <PhotoTile className="mt-3 h-40" />
            <p
              className="sc-ink mt-4 rounded-2xl rounded-tl-sm px-4 py-3 text-base font-semibold leading-snug"
              style={{ background: "var(--sc-bg)" }}
            >
              «Tengo esta foto… ¿y ahora qué publico?»
            </p>
          </Reveal>

          <ol
            aria-label="Qué hace SocialCors"
            className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 lg:flex-col lg:gap-2"
          >
            {TRANSFORM_CHAIN.map((item, i) => (
              <li key={item} className="flex items-center gap-2 lg:flex-col">
                <span
                  className="rounded-full border px-3 py-1 text-xs font-bold"
                  style={{
                    borderColor: i === TRANSFORM_CHAIN.length - 1 ? "var(--sc-accent)" : "var(--sc-line)",
                    background: i === TRANSFORM_CHAIN.length - 1 ? "var(--sc-accent)" : "var(--sc-surface)",
                    color: i === TRANSFORM_CHAIN.length - 1 ? "#fff" : "var(--sc-ink)",
                  }}
                >
                  {item}
                </span>
                {i < TRANSFORM_CHAIN.length - 1 && (
                  <span aria-hidden="true" className="sc-accent text-sm font-black">
                    <span className="lg:hidden">→</span>
                    <span className="hidden lg:inline">↓</span>
                  </span>
                )}
              </li>
            ))}
          </ol>

          <Reveal delay={0.1}>
            <p className="sc-eyebrow mb-3">Después</p>
            <AppWindow title="Analizar y publicar con IA">
              <div className="p-3 sm:p-4">
                <GeneratedPost />
              </div>
            </AppWindow>
            <p className="sc-muted mt-3 text-xs">Ejemplo ilustrativo de la interfaz de SocialCors.</p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ── TU NEGOCIO YA TE OCUPA SUFICIENTE TIEMPO ────────────────────────────────
export function YourTime() {
  return (
    <section aria-labelledby="time-title" className="px-4 py-16 sm:px-6 md:py-20" style={{ background: "var(--sc-surface)" }}>
      <Reveal className="mx-auto max-w-3xl text-center">
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

// ── REDES ───────────────────────────────────────────────────────────────────
const NETWORK_STYLE: Record<(typeof AVAILABLE_NETWORKS)[number]["key"], { bg: string; abbr: string }> = {
  instagram: { bg: "linear-gradient(135deg,#F58529,#DD2A7B 60%,#8134AF)", abbr: "IG" },
  linkedin: { bg: "#0A66C2", abbr: "in" },
};

export function Networks() {
  return (
    <section id="redes" aria-labelledby="networks-title" className="px-4 py-16 sm:px-6 md:py-20">
      <div className="mx-auto max-w-4xl">
        <Reveal>
          <SectionHead eyebrow="Redes" title={<span id="networks-title">Publica en las redes que ya usas.</span>}>
            Estas son las redes que SocialCors soporta hoy.
          </SectionHead>
        </Reveal>
        <ul className="mx-auto mt-10 grid max-w-2xl gap-4 sm:grid-cols-2">
          {AVAILABLE_NETWORKS.map((network, i) => (
            <li key={network.key}>
              <Reveal delay={i * 0.08} className="sc-card flex items-center gap-4 p-5">
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-black text-white"
                  style={{ background: NETWORK_STYLE[network.key].bg }}
                >
                  {NETWORK_STYLE[network.key].abbr}
                </span>
                <h3 className="text-base font-black leading-snug">
                  <span className="sc-ink">{network.name}</span>
                  <span className="sc-muted font-semibold"> · {network.detail}</span>
                </h3>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ── DEMOSTRACIÓN ────────────────────────────────────────────────────────────
const DEMO_FLOW = ["Cuenta", "Perfil", "Base de conocimiento", "Subir contenido", "IA", "Resultado", "Calendario"];

export function Demo() {
  return (
    <section id="demo" aria-labelledby="demo-title" className="px-4 py-16 sm:px-6 md:py-20">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHead title={<span id="demo-title">Mira SocialCors en acción.</span>} />
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
            <div className="sc-app flex min-h-[15rem] flex-col items-center justify-center gap-6 p-6 sm:aspect-video">
              <ol className="flex max-w-3xl flex-wrap items-center justify-center gap-x-2 gap-y-3">
                {DEMO_FLOW.map((step, i) => (
                  <li key={step} className="flex items-center gap-2">
                    <span className="sc-app-chip !text-xs !px-3 !py-1" data-on={i === DEMO_FLOW.length - 1 || i === 4}>
                      {step}
                    </span>
                    {i < DEMO_FLOW.length - 1 && (
                      <span aria-hidden="true" style={{ color: "var(--sc-app-muted)" }}>→</span>
                    )}
                  </li>
                ))}
              </ol>
              <p className="text-center text-sm font-semibold" style={{ color: "var(--sc-app-muted)" }}>
                Demostración en vídeo: próximamente.
              </p>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}

// ── PRUEBA GRATUITA + PLANES ────────────────────────────────────────────────
export function TrialAndPlans() {
  return (
    <section aria-labelledby="trial-title" className="px-4 py-8 sm:px-6 md:py-12">
      <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
        <Reveal className="sc-tint flex flex-col items-start gap-4 p-8">
          <p className="sc-eyebrow">Prueba gratuita</p>
          <h2 id="trial-title" className="sc-ink text-3xl font-black leading-[1.1] tracking-tight">
            {TRIAL_DAYS} días gratis para probarlo.
          </h2>
          <ul className="flex flex-col gap-2 text-sm font-semibold">
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
          <Link href={HREF_START} className="sc-btn mt-2">
            Empieza a probar SocialCors
          </Link>
        </Reveal>

        <Reveal delay={0.08} className="sc-card flex flex-col items-start gap-4 p-8">
          <p className="sc-eyebrow">Planes</p>
          <h2 className="sc-ink text-3xl font-black leading-[1.1] tracking-tight">Empieza con SocialCors</h2>
          <p className="sc-muted text-base leading-relaxed">
            Elige el plan que mejor se adapta a la cantidad de contenido que necesitas crear.
          </p>
          <Link href={HREF_PLANS} className="sc-btn-ghost mt-2">
            Ver planes
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

// ── FAQ ─────────────────────────────────────────────────────────────────────
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
    <section id="faq" aria-labelledby="faq-title" className="px-4 py-16 sm:px-6 md:py-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <SectionHead eyebrow="Preguntas frecuentes" title={<span id="faq-title">Lo que suele preguntarse antes de empezar.</span>} />
        </Reveal>
        <div className="sc-faq mt-10 flex flex-col gap-3">
          {FAQ.map((item) => (
            <details key={item.q} className="sc-card group px-5 py-4">
              <summary className="flex items-center justify-between gap-4">
                <h3 className="sc-ink text-base font-bold">{item.q}</h3>
                <svg
                  className="sc-chev sc-muted h-4 w-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </summary>
              <p className="sc-muted mt-3 text-sm leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── CTA FINAL ───────────────────────────────────────────────────────────────
export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="px-4 py-16 sm:px-6 md:py-20">
      <Reveal className="mx-auto max-w-5xl">
        <div
          className="rounded-3xl px-6 py-14 text-center md:px-12 md:py-20"
          style={{ background: "var(--sc-accent-strong)" }}
        >
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
      </Reveal>
    </section>
  );
}

// ── FOOTER ──────────────────────────────────────────────────────────────────
export function LandingFooter() {
  const links = [
    { label: "Planes", href: HREF_PLANS },
    { label: "Iniciar sesión", href: HREF_LOGIN },
    { label: "Privacidad", href: "/privacidad" },
    { label: "Contacto", href: "/contact" },
  ];
  return (
    <footer className="border-t px-4 py-10 sm:px-6" style={{ borderColor: "var(--sc-line)" }}>
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_URL} alt="" width={32} height={32} loading="lazy" className="h-8 w-8 object-contain" />
          <span className="sc-ink text-base font-black tracking-tight">SocialCors</span>
        </div>
        <nav aria-label="Pie de página" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {links.map((l) => (
            <Link key={l.label} href={l.href} className="sc-muted text-sm font-semibold hover:text-[var(--sc-ink)]">
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="sc-muted text-xs">© {new Date().getFullYear()} SocialCors by Drako. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
