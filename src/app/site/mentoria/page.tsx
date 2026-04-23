import Link from "next/link";
import { ArrowRight, BarChart3, BrainCircuit, MessageSquare, ShieldCheck, Sparkles } from "lucide-react";

const valueBlocks = [
  {
    title: "Tutor real por WhatsApp",
    description: "El alumno entra por el canal que ya usa. La IA responde con contexto, continuidad y foco académico real.",
    icon: MessageSquare,
  },
  {
    title: "Confianza para la familia",
    description: "No es una caja negra. Hay señales, memoria, resumen de avance y una experiencia pensada para reducir fricción, no para aumentarla.",
    icon: ShieldCheck,
  },
  {
    title: "Producto con criterio de negocio",
    description: "Mentoría no vende solo chat. Vende continuidad, retención, percepción de acompañamiento y operación escalable.",
    icon: BarChart3,
  },
];

const promiseBlocks = [
  "Onboarding estructural para tutores y alumno",
  "Entrada diaria del alumno para adaptar la sesión real",
  "Workspace operativo con pizarra, copilot y continuidad",
  "Memoria académica y señales de progreso",
  "Canal WhatsApp como ventaja de uso y recurrencia",
  "Lectura clara para familias y equipos educativos",
];

export default function MentoriaLandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top,#1e293b_0%,#020617_55%)] px-6 py-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
              <Sparkles className="h-4 w-4" />
              IA educativa con uso real
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-tight text-white sm:text-7xl">
              Mentoría que entra por WhatsApp,
              <span className="block text-emerald-300">entiende cómo llega hoy el alumno</span>
              y acompaña con criterio.
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
              Mentoría separa identidad, contexto familiar y estado diario del alumno para que cada sesión nazca mejor.
              Más continuidad para la familia. Más valor percibido para el negocio. Menos fricción para empezar a usarlo de verdad.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/mentorias/auths/registrations?__drako_host=mentoria.drako.systems"
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-6 py-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
              >
                Crear espacio de Mentoría
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/mentorias/auths/logins?__drako_host=mentoria.drako.systems"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/5"
              >
                Entrar al workspace
              </Link>
            </div>

            <div className="mt-10 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-2xl font-black text-white">24/7</div>
                <div className="mt-1">acompañamiento accesible por WhatsApp</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-2xl font-black text-white">1 entrada diaria</div>
                <div className="mt-1">para calibrar el modo real de la sesión</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-2xl font-black text-white">3 superficies</div>
                <div className="mt-1">familia, workspace y tutor IA alineados</div>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
            <div className="rounded-[28px] border border-emerald-300/20 bg-slate-950/90 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Sesion real</div>
                  <div className="mt-2 text-2xl font-bold">Hoy el alumno entra con estado diario explícito</div>
                </div>
                <BrainCircuit className="h-10 w-10 text-emerald-300" />
              </div>

              <div className="mt-6 space-y-3 rounded-3xl bg-slate-900 p-5 text-sm text-slate-200">
                <div className="rounded-2xl bg-white/5 px-4 py-3">Prioridad: preparar examen de Matemáticas</div>
                <div className="rounded-2xl bg-white/5 px-4 py-3">Cómo viene hoy: cansado pero disponible</div>
                <div className="rounded-2xl bg-white/5 px-4 py-3">Tipo de ayuda: paso a paso con práctica guiada</div>
                <div className="rounded-2xl bg-emerald-400/10 px-4 py-3 text-emerald-100">
                  Resultado: la IA ajusta el tono, el modo de sesión y el primer paso antes de responder.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Por qué ahora tiene sentido</div>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">
              Un producto de IA educativa que suena humano,
              <span className="block text-slate-300">pero opera como sistema serio.</span>
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {valueBlocks.map((block) => (
              <div key={block.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <block.icon className="h-8 w-8 text-emerald-300" />
                <h3 className="mt-5 text-xl font-bold text-white">{block.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-300">{block.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-slate-900/60 px-6 py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">Arquitectura de valor</div>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-white">Mentoría no es solo onboarding, ni solo chat.</h2>
            <p className="mt-4 text-base leading-8 text-slate-300">
              Primero se registra la estructura familiar y académica. Después, cada día, el alumno entra indicando prioridad, energía y tipo de ayuda.
              Ese corte hace que la identidad no se mezcle con el estado del momento y mejora la adaptación real de la sesión.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {promiseBlocks.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-medium text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-5xl rounded-[32px] border border-emerald-300/20 bg-gradient-to-br from-emerald-400/15 to-slate-900 p-10 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-200">Listo para probar</div>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">La ventaja no es solo la IA. Es que se usa donde ya vive el alumno.</h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-slate-200">
            WhatsApp baja la fricción. El workspace ordena la experiencia. La familia entiende qué está pasando.
            Esa combinación convierte Mentoría en un producto más creíble, más útil y más fácil de sostener.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/mentorias/auths/registrations?__drako_host=mentoria.drako.systems"
              className="rounded-2xl bg-white px-6 py-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-100"
            >
              Empezar onboarding
            </Link>
            <Link
              href="/mentorias/auths/logins?__drako_host=mentoria.drako.systems"
              className="rounded-2xl border border-white/20 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/5"
            >
              Ya tengo acceso
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
