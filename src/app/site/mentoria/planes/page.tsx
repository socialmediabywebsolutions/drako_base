import Link from "next/link";

const PLANS = [
  {
    id: "free",
    name: "Gratis",
    price: "0€",
    period: "para siempre",
    tagline: "Prueba sin compromiso",
    color: "bg-gray-50 border-gray-200",
    badge: null,
    cta: "Empezar gratis",
    ctaHref: "/mentorias/auths/registrations",
    ctaStyle: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    limits: [
      "3 sesiones guiadas al día",
      "5 ejercicios al día",
      "1 alumno",
      "Hub de padres básico",
    ],
    extras: [],
  },
  {
    id: "pro",
    name: "Pro",
    price: "14€",
    period: "por mes",
    tagline: "Para un alumno con ritmo exigente",
    color: "bg-white border-blue-200",
    badge: "Más popular",
    cta: "Empezar 15 días gratis",
    ctaHref: "/mentorias/auths/registrations?plan=pro",
    ctaStyle: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-200",
    limits: [
      "20 sesiones guiadas al día",
      "40 ejercicios al día",
      "1 alumno",
      "Hub de padres completo",
    ],
    extras: [
      "Intervenciones adaptativas",
      "Insights avanzados para padres",
      "Motivación IA personalizada",
      "Resúmenes por WhatsApp",
    ],
  },
  {
    id: "family",
    name: "Familia",
    price: "24€",
    period: "por mes",
    tagline: "Varios hijos, un solo panel",
    color: "bg-white border-purple-200",
    badge: null,
    cta: "Empezar 15 días gratis",
    ctaHref: "/mentorias/auths/registrations?plan=family",
    ctaStyle: "bg-purple-600 text-white hover:bg-purple-700 shadow-sm shadow-purple-200",
    limits: [
      "60 sesiones guiadas al día",
      "120 ejercicios al día",
      "Hasta 5 alumnos",
      "Hub de padres completo",
    ],
    extras: [
      "Todo lo del plan Pro",
      "Perfiles separados por hijo",
      "Acceso independiente a ambos progenitores",
      "Panel familiar multiperfil",
    ],
  },
];

const FAQ = [
  {
    q: "¿Necesito tarjeta de crédito para el trial?",
    a: "No. Los 15 días de prueba son completamente gratuitos, sin datos de pago.",
  },
  {
    q: "¿Cómo funciona el aprendizaje adaptativo?",
    a: "El tutor IA aprende el nivel real de tu hijo sesión a sesión — dónde se atasca, qué conceptos domina, cuándo se frustra. Con esa memoria, adapta el ritmo, el tono y los ejercicios en tiempo real.",
  },
  {
    q: "¿Puedo cambiar de plan más adelante?",
    a: "Sí, en cualquier momento desde tu panel. El cambio se aplica al inicio del siguiente ciclo.",
  },
  {
    q: "¿Qué pasa cuando termina el trial?",
    a: "Te avisamos con 3 días de antelación. Si no añades un método de pago, la cuenta pasa al plan gratuito automáticamente.",
  },
  {
    q: "¿Funciona para Primaria, ESO y Bachillerato?",
    a: "Sí. Los agentes están calibrados para todos los cursos del sistema educativo español, desde 1º de Primaria hasta 2º de Bachillerato.",
  },
];

export default function MentoriaPlansPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/site/mentoria" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 text-xs font-black text-white">M</span>
          <span className="text-sm font-bold text-gray-900">Mentoria</span>
        </Link>
        <Link
          href="/mentorias/auths/logins"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Ya tengo cuenta →
        </Link>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-6 pb-12 pt-8 text-center">
        <h1 className="text-4xl font-black tracking-tight text-gray-950 sm:text-5xl">
          Un tutor IA que aprende
          <br />
          <span className="text-blue-600">a tu hijo</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-gray-500">
          No responde por formulario. Adapta el nivel, recuerda lo que cuesta
          y avisa a los padres cuando algo va bien — o cuando no.
        </p>
        <p className="mt-3 text-sm font-medium text-emerald-600">
          15 días gratis · sin tarjeta de crédito · cancela cuando quieras
        </p>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="grid gap-6 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border-2 p-6 ${plan.color}`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow">
                  {plan.badge}
                </div>
              )}

              <div className="mb-4">
                <div className="text-xs font-bold uppercase tracking-widest text-gray-400">{plan.name}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-gray-950">{plan.price}</span>
                  <span className="text-sm text-gray-400">/{plan.period}</span>
                </div>
                <p className="mt-1.5 text-sm text-gray-500">{plan.tagline}</p>
              </div>

              <Link
                href={plan.ctaHref}
                className={`mb-6 block rounded-xl px-4 py-2.5 text-center text-sm font-bold transition ${plan.ctaStyle}`}
              >
                {plan.cta}
              </Link>

              <div className="space-y-2">
                {plan.limits.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm text-gray-600">
                    <span className="mt-0.5 shrink-0 text-gray-300">○</span>
                    {item}
                  </div>
                ))}
                {plan.extras.length > 0 && (
                  <>
                    <div className="my-3 h-px bg-gray-100" />
                    {plan.extras.map((item) => (
                      <div key={item} className="flex items-start gap-2 text-sm text-gray-700">
                        <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>
                        {item}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature comparison */}
      <section className="mx-auto max-w-3xl px-6 pb-16">
        <h2 className="mb-6 text-center text-xl font-bold text-gray-900">Lo que incluye cada plan</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-3 text-left font-medium text-gray-400">Funcionalidad</th>
                {PLANS.map((p) => (
                  <th key={p.id} className="pb-3 text-center font-bold text-gray-700">{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {[
                ["Tutor IA por materia",               true,  true,  true ],
                ["Sesiones guiadas por IA",            "3/día","20/día","60/día"],
                ["Memoria del alumno",                  true,  true,  true ],
                ["Resúmenes a padres (WhatsApp)",       false, true,  true ],
                ["Hub de padres completo",              false, true,  true ],
                ["Intervenciones adaptativas",          false, true,  true ],
                ["Hasta 5 alumnos en un panel",        false, false, true ],
                ["Acceso para ambos progenitores",      false, false, true ],
                ["Perfiles independientes por hijo",    false, false, true ],
              ].map(([feat, free, pro, fam]) => (
                <tr key={String(feat)} className="hover:bg-gray-50/50">
                  <td className="py-3 text-gray-600">{feat}</td>
                  {[free, pro, fam].map((v, i) => (
                    <td key={i} className="py-3 text-center">
                      {v === true  ? <span className="text-emerald-500">✓</span>
                      : v === false ? <span className="text-gray-200">—</span>
                      : <span className="font-medium text-gray-700">{v}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-2xl px-6 pb-20">
        <h2 className="mb-8 text-center text-xl font-bold text-gray-900">Preguntas frecuentes</h2>
        <div className="space-y-4">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="rounded-xl border border-gray-100 p-5">
              <div className="font-semibold text-gray-900">{q}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t border-gray-100 bg-gray-50/50">
        <div className="mx-auto max-w-2xl px-6 py-14 text-center">
          <p className="text-lg font-semibold text-gray-900">¿Dudas antes de empezar?</p>
          <p className="mt-1 text-sm text-gray-500">
            Escríbenos y te respondemos en menos de 24 horas.
          </p>
          <a
            href="mailto:hola@mentoria.drako.systems"
            className="mt-4 inline-block rounded-xl bg-gray-900 px-6 py-3 text-sm font-bold text-white hover:bg-gray-800"
          >
            Contactar →
          </a>
        </div>
      </section>
    </div>
  );
}
