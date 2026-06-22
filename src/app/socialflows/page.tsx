import Link from "next/link";

const capabilities = [
  {
    title: "Conoce tu empresa",
    description:
      "Ingesta tu web, documentos, productos y tono de marca. La IA aprende quién eres antes de escribir una sola línea.",
  },
  {
    title: "Crea campañas completas",
    description:
      "Define el objetivo, la audiencia y el canal. La IA genera el calendario de contenidos, los copies y las imágenes de toda la campaña.",
  },
  {
    title: "Publica automáticamente",
    description:
      "Programación inteligente que elige el mejor horario por red social y ejecuta sin intervención humana.",
  },
  {
    title: "Responde con tu voz",
    description:
      "La IA responde comentarios y DMs usando el conocimiento real de tu empresa. Nunca respuestas genéricas.",
  },
  {
    title: "Detecta leads en tiempo real",
    description:
      "Identifica automáticamente a los seguidores con intención de compra y los añade a tu pipeline con contexto de la conversación.",
  },
  {
    title: "Analiza el sentimiento",
    description:
      "Entiende cómo percibe tu audiencia cada campaña, producto y mensaje. Ajusta la estrategia con datos, no con intuición.",
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
    description: "Para creadores y marcas personales que quieren un marketing profesional sin contratar un equipo.",
    features: [
      "1 marca con base de conocimiento",
      "Generación de campañas con IA",
      "Publicación automática en 3 canales",
      "Respuestas automáticas con IA",
      "Detección de leads",
      "Analytics de sentimiento básico",
    ],
    cta: "Empezar con Creator",
  },
  {
    name: "Pro",
    price: "99€",
    description: "Para empresas y agencias que gestionan múltiples marcas con operaciones de marketing a escala.",
    features: [
      "Hasta 5 marcas con bases de conocimiento independientes",
      "Campañas ilimitadas con IA",
      "Canales sociales ilimitados",
      "Respuestas automáticas multi-cuenta",
      "Pipeline de leads con CRM integrado",
      "Analytics de sentimiento avanzado",
      "Informes de campaña exportables",
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
      <nav className="border-b border-slate-100 bg-white/90 backdrop-blur-sm sticky top-0 z-50">
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
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-24 text-center">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Ahora disponible
        </p>
        <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight text-slate-900 md:text-6xl lg:text-7xl">
          Tu departamento de marketing,<br className="hidden md:block" />{" "}
          <span className="text-slate-500">dirigido por IA.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-slate-600">
          SocialFlow no programa publicaciones. Aprende quién eres, crea campañas completas, publica solo, responde a tu audiencia con tu voz y convierte conversaciones en clientes.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/socialflow/auth"
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-black"
          >
            Activar mi sistema de marketing
          </Link>
          <a
            href="#pricing"
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-7 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Ver precios
          </a>
        </div>
        <p className="mt-4 text-xs text-slate-400">14 días gratis · Sin tarjeta de crédito · Cancela cuando quieras</p>
      </section>

      {/* PROBLEM */}
      <section className="border-y border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            El marketing de redes sociales rompe a la mayoría de las empresas.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-slate-600">
            Contratar un equipo cuesta más de 3.000€/mes. Las agencias no conocen tu negocio. Las herramientas de scheduling solo mueven el problema: alguien tiene que crear, publicar, responder y analizar cada día. El resultado es marketing inconsistente, costoso o abandonado.
          </p>
          <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
            {[
              { label: "El equipo propio", pain: "Caro, lento de contratar y necesita supervisión constante." },
              { label: "La agencia externa", pain: "No conoce tu empresa. El copy suena genérico. Tardas semanas en ver resultados." },
              { label: "Las herramientas de scheduling", pain: "Solo automatizan la distribución. Tú sigues creando todo manualmente." },
            ].map((item) => (
              <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.pain}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTION STATEMENT */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="rounded-3xl bg-slate-900 p-10 text-center md:p-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">La solución</p>
          <h2 className="mx-auto max-w-3xl text-3xl font-bold text-white md:text-4xl">
            Un sistema operativo de marketing con IA que conoce tu empresa mejor que muchos empleados.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-slate-400">
            Ingesta tu base de conocimiento una sola vez. Desde ese momento, SocialFlow crea, publica, responde y analiza de forma autónoma — con tu voz, tu tono y los argumentos correctos para tu negocio.
          </p>
        </div>
      </section>

      {/* CAPABILITIES */}
      <section className="border-y border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-widest text-slate-400">
            Capacidades
          </h2>
          <p className="mb-12 text-center text-2xl font-bold tracking-tight text-slate-900">
            De la estrategia a la conversión, sin intervención manual.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((cap, i) => (
              <article
                key={cap.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <span className="mb-4 inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="text-sm font-semibold text-slate-900">{cap.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{cap.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-widest text-slate-400">
          Cómo funciona
        </h2>
        <p className="mb-12 text-center text-2xl font-bold tracking-tight text-slate-900">
          Tres pasos. Una sola vez. Marketing autónomo para siempre.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              step: "01",
              title: "Entrena a tu IA",
              body: "Conecta tu web, sube documentos, define tu tono y audiencias. SocialFlow construye el modelo mental de tu empresa.",
            },
            {
              step: "02",
              title: "Define una campaña",
              body: "Indica el objetivo: lanzar un producto, generar leads, aumentar comunidad. La IA diseña toda la campaña: copies, formatos, calendario y canales.",
            },
            {
              step: "03",
              title: "El sistema opera solo",
              body: "Publica, responde comentarios y DMs, detecta leads, mide el sentimiento y ajusta la estrategia. Tú supervisas los resultados.",
            },
          ].map((item) => (
            <article key={item.step} className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <span className="text-4xl font-black text-slate-100">{item.step}</span>
              <h3 className="mt-4 text-base font-bold text-slate-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-y border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-2 text-center text-sm font-semibold uppercase tracking-widest text-slate-400">
            Precios
          </h2>
          <p className="mb-3 text-center text-2xl font-bold tracking-tight text-slate-900">
            Menos que el salario de un becario. Más productivo que un equipo.
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
                      <svg
                        className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-900"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
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
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          Tu competencia ya tiene equipo de marketing. Tú puedes tener algo mejor.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-slate-600">
          Empieza en 15 minutos. Conecta tu primera red social, sube tu base de conocimiento y deja que SocialFlow diseñe tu primera campaña.
        </p>
        <Link
          href="/socialflow/auth"
          className="mt-10 inline-flex items-center justify-center rounded-md bg-slate-900 px-8 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-black"
        >
          Activar mi sistema de marketing
        </Link>
        <p className="mt-4 text-xs text-slate-400">14 días gratis · Sin tarjeta de crédito · Cancela cuando quieras</p>
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
