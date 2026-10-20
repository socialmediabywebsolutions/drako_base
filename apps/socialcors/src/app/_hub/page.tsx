/**
 * socialcors.com — Web pública misional
 *
 * Socialcors construye inteligencia artificial para los pilares
 * fundamentales de la sociedad: educación, salud, finanzas y vivienda.
 *
 * NO es un SaaS de community manager (eso es drako.systems).
 * ES la empresa que resuelve los problemas que de verdad importan
 * mediante IA especializada.
 *
 * Diseño: fondo blanco/gris muy claro · azul #3b82f6 · turquesa #06b6d4
 */

import Link from "next/link";
import WaitlistSection from "./_waitlist-section";

const PILLARS = [
  {
    id: "educacion",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    label: "Educación",
    headline: "Apoyo educativo para cada alumno, no para la media.",
    body: "En España, el 28% de los alumnos suspende matemáticas. Los profesores particulares cuestan 30€/hora. Mentoría IA da a cada estudiante un tutor personalizado, disponible las 24 horas, que aprende de su nivel y adapta el ritmo.",
    product: "Mentoría IA",
    status: "En desarrollo activo",
    statusColor: "#059669",
    statusBg: "#ecfdf5",
    accentFrom: "#3b82f6",
    accentTo: "#06b6d4",
  },
  {
    id: "salud",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    ),
    label: "Salud",
    headline: "Información médica de calidad, accesible para todos.",
    body: "Las listas de espera de la sanidad pública superan los 90 días. La mayoría de las personas buscan sus síntomas en Google y se pierden. Una IA especializada puede orientar, informar y ayudar a priorizar — sin reemplazar al médico.",
    product: "Health IA",
    status: "Próximamente",
    statusColor: "#64748b",
    statusBg: "#f1f5f9",
    accentFrom: "#10b981",
    accentTo: "#06b6d4",
  },
  {
    id: "finanzas",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    label: "Finanzas",
    headline: "Finanzas que entiende la gente normal.",
    body: "El 60% de los españoles no entiende su nómina, no ahorra de forma organizada y nunca ha hablado con un asesor financiero. Cazh es una wallet inteligente con IA que explica, planifica y actúa — sin jerga bancaria.",
    product: "Cazh",
    status: "Próximamente",
    statusColor: "#d97706",
    statusBg: "#fffbeb",
    accentFrom: "#f59e0b",
    accentTo: "#06b6d4",
  },
  {
    id: "vivienda",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.5" stroke="currentColor" className="w-7 h-7">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
    label: "Vivienda",
    headline: "Gestión de alquiler sin burocracia ni estrés.",
    body: "Más de 2,5 millones de viviendas en alquiler en España. Propietarios que dedican horas a gestionar incidencias, contratos y cobros. Rentia automatiza todo: desde el scoring del inquilino hasta el parte de reparaciones.",
    product: "Rentia",
    status: "Próximamente",
    statusColor: "#d97706",
    statusBg: "#fffbeb",
    accentFrom: "#3b82f6",
    accentTo: "#8b5cf6",
  },
];

const MANIFESTO_LINES = [
  "Los problemas que más importan llevan décadas sin solución real.",
  "No porque sean difíciles de entender.",
  "Sino porque la tecnología los ha ignorado.",
  "La IA cambia eso.",
];

export default function SocialCorsHubPage() {
  return (
    <div
      className="min-h-screen flex flex-col font-sans antialiased"
      style={{ backgroundColor: "#f8fafc", color: "#0f172a" }}
    >
      {/* ─── Navbar ─────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{ backgroundColor: "rgba(248,250,252,0.92)", backdropFilter: "blur(12px)", borderColor: "#e2e8f0" }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo wordmark */}
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}
            >
              <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <span className="text-base font-black tracking-tight" style={{ color: "#0f172a" }}>
              Socialcors
            </span>
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: "#64748b" }}>
            <a href="#mision" className="hover:text-blue-600 transition-colors">Misión</a>
            <a href="#pilares" className="hover:text-blue-600 transition-colors">Pilares</a>
            <a href="#productos" className="hover:text-blue-600 transition-colors">Productos</a>
          </nav>

          {/* CTA */}
          <a
            href="#waitlist"
            className="px-5 py-2.5 text-sm font-bold rounded-xl transition-all text-white"
            style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}
          >
            Acceso anticipado
          </a>
        </div>
      </header>

      {/* ─── Hero ───────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-8"
          style={{ backgroundColor: "#eff6ff", color: "#3b82f6" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
          Tecnología para la sociedad
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-8"
          style={{ color: "#0f172a" }}>
          Construimos IA para<br />
          <span
            style={{
              backgroundImage: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            los problemas que<br />de verdad importan.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed mb-12"
          style={{ color: "#64748b" }}>
          Educación accesible. Salud para todos.
          Finanzas que entiende la gente normal.
          Vivienda sin burocracia.
        </p>

        {/* Pillar icons row */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {["Educación", "Salud", "Finanzas", "Vivienda"].map((label) => (
            <a key={label} href="#pilares"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border"
              style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", color: "#475569" }}
            >
              {label}
            </a>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#waitlist"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-black rounded-2xl text-white transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)", boxShadow: "0 8px 30px rgba(59,130,246,0.3)" }}
          >
            Quiero acceso anticipado
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </a>
          <a
            href="#mision"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold rounded-2xl transition-all border"
            style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", color: "#374151" }}
          >
            Nuestra misión
          </a>
        </div>
      </section>

      {/* ─── Separador ──────────────────────────────────────────────────── */}
      <div className="w-full max-w-4xl mx-auto px-6">
        <div className="h-px" style={{ background: "linear-gradient(90deg, transparent, #bfdbfe 50%, transparent)" }} />
      </div>

      {/* ─── Manifiesto ─────────────────────────────────────────────────── */}
      <section id="mision" className="max-w-4xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 gap-16 items-center">
          {/* Texto izquierda */}
          <div>
            <span className="text-xs font-black tracking-widest uppercase block mb-6" style={{ color: "#06b6d4" }}>
              Por qué existimos
            </span>
            <h2 className="text-4xl font-black tracking-tight leading-tight mb-8" style={{ color: "#0f172a" }}>
              La tecnología tiene el poder de cambiar la vida cotidiana.
              No la está usando bien.
            </h2>
            <p className="text-base leading-relaxed mb-6" style={{ color: "#64748b" }}>
              Durante décadas, la innovación tecnológica se ha concentrado
              en los problemas de las empresas. CRMs, ERPs, herramientas de
              productividad para oficinas.
            </p>
            <p className="text-base leading-relaxed" style={{ color: "#64748b" }}>
              Los problemas de la gente — aprender, cuidar la salud, entender
              sus finanzas, gestionar su vivienda — han quedado fuera.
              <strong style={{ color: "#0f172a" }}> Socialcors los pone en el centro.</strong>
            </p>
          </div>

          {/* Manifiesto derecha */}
          <div className="space-y-5">
            {MANIFESTO_LINES.map((line, i) => (
              <div key={i} className="flex items-start gap-4 p-5 rounded-2xl border"
                style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black text-white"
                  style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}>
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed font-medium" style={{ color: "#374151" }}>
                  {line}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Los cuatro pilares ─────────────────────────────────────────── */}
      <section id="pilares"
        className="py-24 px-6"
        style={{ backgroundColor: "#ffffff" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-black tracking-widest uppercase block mb-4" style={{ color: "#3b82f6" }}>
              Los pilares de la sociedad
            </span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-5" style={{ color: "#0f172a" }}>
              Cuatro problemas.<br />Cuatro soluciones con IA.
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: "#64748b" }}>
              Cada producto de Socialcors ataca un área donde la IA puede
              transformar la vida real de millones de personas.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {PILLARS.map((p) => (
              <article
                key={p.id}
                className="group relative rounded-3xl p-8 border overflow-hidden transition-all duration-300 hover:-translate-y-1"
                style={{ backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }}
              >
                {/* Glow hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-3xl"
                  style={{
                    background: `radial-gradient(ellipse at top left, rgba(59,130,246,0.07), transparent 60%)`,
                  }}
                />

                {/* Icono + label */}
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
                    style={{ background: `linear-gradient(135deg, ${p.accentFrom}, ${p.accentTo})` }}
                  >
                    {p.icon}
                  </div>
                  <div>
                    <span className="text-xs font-black tracking-widest uppercase block" style={{ color: "#94a3b8" }}>
                      {p.label}
                    </span>
                    <span
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-full inline-block"
                      style={{ backgroundColor: p.statusBg, color: p.statusColor }}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>

                {/* Contenido */}
                <h3 className="text-xl font-black leading-snug mb-4" style={{ color: "#0f172a" }}>
                  {p.headline}
                </h3>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "#64748b" }}>
                  {p.body}
                </p>

                {/* Producto */}
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: `linear-gradient(135deg, ${p.accentFrom}, ${p.accentTo})` }}
                  />
                  <span className="text-xs font-bold" style={{ color: p.accentFrom }}>
                    {p.product}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Productos actuales ─────────────────────────────────────────── */}
      <section id="productos" className="py-24 px-6" style={{ backgroundColor: "#f8fafc" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-black tracking-widest uppercase block mb-4" style={{ color: "#06b6d4" }}>
              El ecosistema
            </span>
            <h2 className="text-4xl font-black tracking-tight mb-5" style={{ color: "#0f172a" }}>
              Productos en marcha
            </h2>
            <p className="text-lg max-w-xl mx-auto" style={{ color: "#64748b" }}>
              Cada SaaS opera de forma independiente con su propia marca,
              pero todos comparten la misma infraestructura de IA.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Mentoría */}
            <div
              className="group relative rounded-3xl p-7 border bg-white overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              style={{ borderColor: "#e2e8f0" }}
            >
              <div className="absolute inset-x-0 top-0 h-1 rounded-t-3xl" style={{ background: "linear-gradient(90deg, #3b82f6, #06b6d4)" }} />
              <div className="pt-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block mb-4"
                  style={{ backgroundColor: "#ecfdf5", color: "#059669" }}>
                  🟢 En desarrollo activo
                </span>
                <h3 className="text-xl font-black mb-2" style={{ color: "#0f172a" }}>Mentoría IA</h3>
                <p className="text-xs font-semibold mb-4" style={{ color: "#3b82f6" }}>Educación · mentoria.socialcors.com</p>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "#64748b" }}>
                  Tutores de IA especializados para matemáticas, física, química, idiomas
                  y programación. Aprendizaje adaptativo al ritmo de cada alumno.
                  Comunicación con padres por WhatsApp.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Matemáticas", "Física", "Idiomas", "Programación"].map((t) => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Cazh */}
            <div
              className="group relative rounded-3xl p-7 border bg-white overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              style={{ borderColor: "#e2e8f0" }}
            >
              <div className="absolute inset-x-0 top-0 h-1 rounded-t-3xl" style={{ background: "linear-gradient(90deg, #f59e0b, #06b6d4)" }} />
              <div className="pt-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block mb-4"
                  style={{ backgroundColor: "#fffbeb", color: "#d97706" }}>
                  🟡 Próximamente
                </span>
                <h3 className="text-xl font-black mb-2" style={{ color: "#0f172a" }}>Cazh</h3>
                <p className="text-xs font-semibold mb-4" style={{ color: "#f59e0b" }}>Finanzas · cazh.socialcors.com</p>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "#64748b" }}>
                  Wallet digital con IA financiera. Transferencias, pagos, tarjetas virtuales
                  y físicas, scoring financiero y asesor IA que habla contigo en lenguaje normal.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Wallet", "Transferencias", "Scoring", "Asesor IA"].map((t) => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Rentia */}
            <div
              className="group relative rounded-3xl p-7 border bg-white overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
              style={{ borderColor: "#e2e8f0" }}
            >
              <div className="absolute inset-x-0 top-0 h-1 rounded-t-3xl" style={{ background: "linear-gradient(90deg, #3b82f6, #8b5cf6)" }} />
              <div className="pt-3">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block mb-4"
                  style={{ backgroundColor: "#fffbeb", color: "#d97706" }}>
                  🟡 Próximamente
                </span>
                <h3 className="text-xl font-black mb-2" style={{ color: "#0f172a" }}>Rentia</h3>
                <p className="text-xs font-semibold mb-4" style={{ color: "#3b82f6" }}>Vivienda · rentia.socialcors.com</p>
                <p className="text-sm leading-relaxed mb-6" style={{ color: "#64748b" }}>
                  Gestión inteligente de alquileres. Cobros automáticos, contratos,
                  incidencias, reparaciones y evaluación de inquilinos con IA.
                  Sin hojas de cálculo ni emails perdidos.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Alquileres", "Contratos", "Incidencias", "Scoring"].map((t) => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Tecnología / cómo funciona ─────────────────────────────────── */}
      <section className="py-20 px-6" style={{ backgroundColor: "#ffffff" }}>
        <div className="max-w-5xl mx-auto">
          <div className="rounded-3xl p-10 md:p-14 relative overflow-hidden border"
            style={{ borderColor: "#e2e8f0", background: "linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%)" }}>
            {/* Decoración */}
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-10 pointer-events-none"
              style={{ background: "radial-gradient(circle, #3b82f6, transparent)" }} />

            <div className="grid md:grid-cols-2 gap-10 items-center relative">
              <div>
                <span className="text-xs font-black tracking-widest uppercase block mb-4" style={{ color: "#3b82f6" }}>
                  Cómo lo construimos
                </span>
                <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-6" style={{ color: "#0f172a" }}>
                  IA especializada,<br />no IA genérica.
                </h2>
                <p className="text-base leading-relaxed mb-6" style={{ color: "#64748b" }}>
                  Cada producto tiene agentes entrenados específicamente para
                  su dominio. No es ChatGPT con una interfaz bonita.
                  Es inteligencia construida desde cero para resolver
                  un problema concreto.
                </p>
                <p className="text-base leading-relaxed" style={{ color: "#64748b" }}>
                  Toda la infraestructura corre en el edge de Cloudflare:
                  sin servidores centrales, sin latencia, sin datos en manos
                  de terceros.
                </p>
              </div>

              <div className="space-y-4">
                {[
                  { label: "Agentes especializados por dominio", detail: "Cada SaaS tiene su propia IA entrenada" },
                  { label: "Datos aislados por cliente", detail: "Tu información nunca mezcla con otro usuario" },
                  { label: "Edge computing en 300 ubicaciones", detail: "Cloudflare Workers — respuesta en <50ms" },
                  { label: "Aprendizaje continuo", detail: "La IA mejora con cada interacción del ecosistema" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-2xl border bg-white"
                    style={{ borderColor: "#e2e8f0" }}>
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "#0f172a" }}>{item.label}</p>
                      <p className="text-xs" style={{ color: "#94a3b8" }}>{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Waitlist ───────────────────────────────────────────────────── */}
      <WaitlistSection />

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t px-6 py-12" style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}>
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            {/* Logo + claim */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-sm font-black" style={{ color: "#0f172a" }}>Socialcors</span>
              </div>
              <p className="text-xs max-w-xs" style={{ color: "#94a3b8" }}>
                Inteligencia artificial para los pilares fundamentales de la sociedad.
              </p>
            </div>

            {/* Productos */}
            <div>
              <p className="text-xs font-bold mb-3 uppercase tracking-widest" style={{ color: "#94a3b8" }}>Productos</p>
              <div className="flex flex-col gap-1.5">
                {["Mentoría IA", "Cazh", "Rentia", "Health IA"].map((name) => (
                  <span key={name} className="text-sm font-medium" style={{ color: "#64748b" }}>{name}</span>
                ))}
              </div>
            </div>

            {/* Legal */}
            <div>
              <p className="text-xs font-bold mb-3 uppercase tracking-widest" style={{ color: "#94a3b8" }}>Legal</p>
              <nav className="flex flex-col gap-1.5">
                {[
                  { label: "Aviso legal", href: "/aviso-legal" },
                  { label: "Privacidad", href: "/privacidad" },
                  { label: "Términos", href: "/terminos" },
                  { label: "Cookies", href: "/cookies" },
                ].map((l) => (
                  <Link key={l.label} href={l.href}
                    className="text-sm font-medium hover:text-blue-600 transition-colors"
                    style={{ color: "#64748b" }}>
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Ecosistema */}
            <div>
              <p className="text-xs font-bold mb-3 uppercase tracking-widest" style={{ color: "#94a3b8" }}>Ecosistema</p>
              <a href="https://drako.systems" target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium hover:text-blue-600 transition-colors block"
                style={{ color: "#64748b" }}>
                drako.systems →
              </a>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3"
            style={{ borderColor: "#f1f5f9" }}>
            <p className="text-xs" style={{ color: "#cbd5e1" }}>© 2026 Socialcors · Todos los derechos reservados</p>
            <p className="text-xs" style={{ color: "#cbd5e1" }}>Parte del ecosistema <a href="https://drako.systems" className="hover:text-blue-400 transition-colors">Drako</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
