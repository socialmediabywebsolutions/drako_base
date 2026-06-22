import Link from "next/link";

const features = [
  {
    title: "Programación inteligente",
    description: "Planifica semanas de contenido en minutos. Elige fecha, hora y red social desde un calendario visual.",
  },
  {
    title: "Gestión de campañas",
    description: "Organiza tus publicaciones por campañas y objetivos. Mide el impacto de cada iniciativa.",
  },
  {
    title: "Analytics en tiempo real",
    description: "Métricas de alcance, engagement y crecimiento de audiencia integradas directamente en el panel.",
  },
  {
    title: "Bandeja de conversaciones",
    description: "Responde DMs y comentarios de todas tus redes desde un único lugar sin cambiar de pestaña.",
  },
  {
    title: "Gestión de leads",
    description: "Convierte seguidores en clientes. Registra y da seguimiento a contactos que llegan por redes.",
  },
  {
    title: "Multi-canal",
    description: "Instagram, LinkedIn, Facebook y más. Conecta todas tus cuentas y publica en todas a la vez.",
  },
];

const plans: Array<{
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
}> = [
  {
    name: "Creator",
    price: "49€",
    description: "Para creadores, freelancers y marcas personales que quieren publicar con consistencia.",
    features: [
      "1 marca / perfil",
      "Hasta 3 canales sociales",
      "Programación ilimitada",
      "Analytics básicos",
      "Bandeja de conversaciones",
      "Gestión de leads",
    ],
    cta: "Empezar con Creator",
  },
  {
    name: "Pro",
    price: "99€",
    description: "Para agencias y equipos que gestionan múltiples marcas con volumen alto de publicaciones.",
    features: [
      "Hasta 5 marcas",
      "Canales sociales ilimitados",
      "Programación ilimitada",
      "Analytics avanzados con exportación",
      "Bandeja de conversaciones multi-cuenta",
      "Gestión de leads con etiquetas",
      "Gestión de campañas",
      "Soporte prioritario",
    ],
    highlighted: true,
    cta: "Empezar con Pro",
  },
];

export default function SocialflowsLandingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">

      {/* NAV */}
      <nav className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-base font-bold tracking-tight">SocialFlow</span>
          <div className="flex items-center gap-3">
            <Link
              href="/socialflow/auth"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/socialflow/auth"
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-black"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          SocialFlow — Gestión de Redes Sociales
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">
          Publica con consistencia.<br className="hidden md:block" /> Sin caos.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
          Planifica campañas, programa publicaciones en todas tus redes sociales y responde a tu audiencia — todo desde un único panel.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/socialflow/auth"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-black"
          >
            Empieza gratis 14 días
          </Link>
          <a
            href="#pricing"
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Ver precios
          </a>
        </div>
        <p className="mt-4 text-xs text-slate-400">Sin tarjeta de crédito. Cancela cuando quieras.</p>
      </section>

      {/* FEATURES */}
      <section className="border-y border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-widest text-slate-500">
            Funcionalidades
          </h2>
          <p className="mb-12 text-center text-2xl font-bold tracking-tight text-slate-900">
            Todo lo que necesitas para gestionar tus redes
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-sm font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PROBLEM / SOLUTION */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">El problema</p>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Publicar a diario agota. Improvisar cada semana destruye la consistencia.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Cambiar de app para programar, responder DMs y analizar métricas consume horas que podrías dedicar a crear mejor contenido.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-900 bg-slate-900 p-8 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">La solución</p>
            <h2 className="text-xl font-bold tracking-tight text-white">
              Un panel. Todas tus redes. Tu estrategia visible de un vistazo.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              SocialFlow centraliza programación, conversaciones, leads y analítica. Planifica el mes entero en una tarde y ejecuta sin fricciones.
            </p>
          </article>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-y border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-widest text-slate-500">
            Precios
          </h2>
          <p className="mb-4 text-center text-2xl font-bold tracking-tight text-slate-900">
            Planes simples. Sin sorpresas.
          </p>
          <p className="mb-12 text-center text-sm text-slate-500">14 días de prueba gratuita en cualquier plan.</p>
          <div className="mx-auto grid max-w-3xl gap-6 md:grid-cols-2">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={
                  "flex flex-col rounded-2xl border bg-white p-8 shadow-sm " +
                  (plan.highlighted
                    ? "border-slate-900 ring-2 ring-slate-900 ring-offset-2"
                    : "border-slate-200")
                }
              >
                {plan.highlighted && (
                  <span className="mb-4 self-start rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    Más popular
                  </span>
                )}
                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                  <span className="text-sm font-medium text-slate-500">/mes</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{plan.description}</p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-slate-700">
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/socialflow/auth"
                  className={
                    "mt-8 inline-flex w-full items-center justify-center rounded-md px-5 py-3 text-sm font-semibold transition " +
                    (plan.highlighted
                      ? "bg-slate-900 text-white hover:bg-black"
                      : "border border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50")
                  }
                >
                  {plan.cta}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Tu próximo mes de contenido puede quedar listo hoy.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          Empieza en minutos. Sin instalaciones, sin configuración compleja.
        </p>
        <Link
          href="/socialflow/auth"
          className="mt-8 inline-flex items-center justify-center rounded-md bg-slate-900 px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-black"
        >
          Crear cuenta gratis
        </Link>
        <p className="mt-3 text-xs text-slate-400">14 días gratis · Sin tarjeta de crédito · Cancela cuando quieras</p>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto max-w-6xl px-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} SocialFlow by Drako Systems
        </div>
      </footer>
    </main>
  );
}
