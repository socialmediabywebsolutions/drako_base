import Link from "next/link";

const benefits = [
  "Ahorra tiempo cada semana con publicaciones planificadas",
  "Organiza tu estrategia por campañas y objetivos",
  "Mantén constancia sin depender de recordatorios manuales",
];

const plans: Array<{
  name: string;
  price: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}> = [
  {
    name: "Starter",
    price: "$19",
    description: "Para emprendedores que quieren orden y consistencia.",
    features: ["1 marca", "Hasta 3 campañas activas", "Hasta 60 publicaciones/mes", "Calendario semanal"],
  },
  {
    name: "Pro",
    price: "$49",
    description: "Para equipos en crecimiento con ritmo constante.",
    features: ["Hasta 3 marcas", "Campañas ilimitadas", "Hasta 300 publicaciones/mes", "Soporte prioritario"],
    highlighted: true,
  },
  {
    name: "Agency",
    price: "$99",
    description: "Para agencias que gestionan múltiples clientes.",
    features: ["Hasta 10 marcas", "Publicaciones ilimitadas", "Vista multi-cliente", "Onboarding guiado"],
  },
];

const audience = [
  {
    title: "Emprendedores",
    text: "Planifican su contenido en minutos y dejan de improvisar cada semana.",
  },
  {
    title: "Agencias",
    text: "Centralizan campañas y calendario de varios clientes en un solo panel.",
  },
  {
    title: "Creadores de contenido",
    text: "Convierten ideas sueltas en una rutina de publicación constante.",
  },
] as const;

export default function SocialflowsLandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-white text-slate-900">
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-16">
        <div className="rounded-3xl border border-slate-200/70 bg-white p-8 shadow-sm md:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">SocialFlow</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
            Planifica, organiza y automatiza tus redes sociales en un solo lugar.
          </h1>
          <p className="mt-4 max-w-3xl text-base text-slate-600 md:text-lg">
            Crea campañas, programa publicaciones y mantén una presencia constante sin operar en modo urgencia.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/socialflow"
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black"
            >
              Empieza tu demo
            </Link>
            <a
              href="#pricing"
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300"
            >
              Ver planes
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 md:grid-cols-3">
        {benefits.map((benefit) => (
          <article key={benefit} className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-700">{benefit}</p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-6 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight">El problema</h2>
            <p className="mt-3 text-sm text-slate-600">
              Cuando el contenido se improvisa, la marca pierde constancia y el equipo pierde tiempo. Publicar no debería
              depender de apagar incendios cada día.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold tracking-tight">La solución</h2>
            <p className="mt-3 text-sm text-slate-600">
              SocialFlow convierte ideas en un plan visible: campañas claras, publicaciones programadas y calendario semanal
              para ejecutar con foco.
            </p>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight">Cómo funciona</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <StepCard number="1" title="Crea tu campaña" text="Define objetivo y enfoque comercial." />
            <StepCard number="2" title="Programa tus publicaciones" text="Asigna fecha y organiza tu semana." />
            <StepCard number="3" title="Ejecuta con consistencia" text="Sigue el calendario y mantén ritmo." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-14">
        <h2 className="text-xl font-semibold tracking-tight">Ideal para</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {audience.map((segment) => (
            <article key={segment.title} className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">{segment.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{segment.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="text-xl font-semibold tracking-tight">Pricing simple para empezar ya</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={
                "rounded-2xl border bg-white p-6 shadow-sm " +
                (Boolean((plan as { highlighted?: boolean }).highlighted)
                  ? "border-slate-900 ring-1 ring-slate-900"
                  : "border-slate-200/70")
              }
            >
              <h3 className="text-base font-semibold">{plan.name}</h3>
              <p className="mt-2 text-3xl font-semibold">{plan.price}<span className="text-sm font-medium text-slate-500">/mes</span></p>
              <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {plan.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
              <Link
                href="/socialflow"
                className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
              >
                Empezar ahora
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Tu próximo mes de contenido puede quedar listo hoy</h2>
          <p className="mt-2 text-sm text-slate-600">Empieza con una campaña y tu primera semana programada en minutos.</p>
          <Link
            href="/socialflow"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-black"
          >
            Crear mi cuenta
          </Link>
        </div>
      </section>
    </main>
  );
}

function StepCard(props: { number: string; title: string; text: string }) {
  return (
    <article className="rounded-xl border border-slate-200/70 bg-slate-50 p-4">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
        {props.number}
      </span>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">{props.title}</h3>
      <p className="mt-1 text-sm text-slate-600">{props.text}</p>
    </article>
  );
}
