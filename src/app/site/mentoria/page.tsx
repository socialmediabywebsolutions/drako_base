import Link from "next/link";
import { ArrowRight, BookOpen, MessageSquareMore, ShieldCheck, Sparkles, Users } from "lucide-react";

const strengths = [
  {
    title: "Tutor IA que explica de verdad",
    description: "No responde como un panel. Explica, guía y adapta el nivel según el alumno real.",
    icon: Sparkles,
  },
  {
    title: "Pizarra viva, no dashboard",
    description: "La atención va a lo que se estudia ahora mismo: tema, ejercicio, examen o duda concreta.",
    icon: BookOpen,
  },
  {
    title: "Familia vinculada sin mezclas",
    description: "Padres y alumnos entran a espacios distintos, pero comparten contexto, memoria y seguimiento.",
    icon: Users,
  },
];

const useCases = [
  "Traer una tarea o examen por WhatsApp y convertirlo en explicación guiada",
  "Preguntar una duda libre de clase y verla ordenada en la pizarra",
  "Reforzar una materia concreta aunque no haya deberes ese día",
  "Acompañar a varios alumnos de la misma familia sin mezclar perfiles",
];

export default function MentoriaLandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <section
        className="relative min-h-[88vh] overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(rgba(2,6,23,0.58), rgba(2,6,23,0.72)), url('https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1800&q=80')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="mx-auto flex min-h-[88vh] max-w-7xl flex-col justify-between px-6 py-8 lg:px-8">
          <header className="flex flex-wrap items-center justify-between gap-4 text-white">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">Mentoria</div>
              <div className="mt-2 text-sm text-white/80">Acompañamiento educativo con IA, familia y memoria real.</div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/mentorias/auths/logins?role=student&__drako_host=mentoria.drako.systems"
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/16"
              >
                Entrar como alumno
              </Link>
              <Link
                href="/mentorias/auths/logins?role=guardian&__drako_host=mentoria.drako.systems"
                className="rounded-full border border-white/20 bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-100"
              >
                Entrar como padre o tutor
              </Link>
            </div>
          </header>

          <div className="grid gap-10 py-14 lg:grid-cols-[1.08fr_0.92fr] lg:items-end">
            <div className="max-w-4xl text-white">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-black/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
                <MessageSquareMore className="h-4 w-4" />
                IA educativa con uso real
              </div>
              <h1 className="mt-6 text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
                La clase guiada que acompaña al alumno
                <span className="block text-emerald-300">y mantiene a la familia conectada.</span>
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-white/82 sm:text-xl">
                Mentoría convierte dudas, tareas, exámenes y fotos de clase en una explicación guiada con memoria real.
                El alumno entra a estudiar. La familia entra a acompañar. La IA une ambas cosas sin parecer un CRM.
              </p>

              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/mentorias/auths/logins?role=student&__drako_host=mentoria.drako.systems"
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-6 py-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
                >
                  Entrar como alumno
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/mentorias/auths/logins?role=guardian&__drako_host=mentoria.drako.systems"
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-black/15 px-6 py-4 text-sm font-semibold text-white transition hover:bg-white/8"
                >
                  Entrar como padre o tutor
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[28px] border border-white/14 bg-white/92 p-6 text-slate-950 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <MessageSquareMore className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">WhatsApp integrado</div>
                    <div className="mt-1 text-lg font-bold">Trae una foto, una tarea o un examen al instante</div>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-700">
                  Es el canal fuerte del producto: baja fricción, mantiene continuidad y deja que el tutor convierta material real en pizarra guiada.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/14 bg-black/20 p-5 text-white backdrop-blur-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Alumno</div>
                  <div className="mt-2 text-lg font-bold">Pregunta, estudia y entiende</div>
                  <p className="mt-2 text-sm leading-6 text-white/78">
                    Pizarra dominante, tutor flotante y ayuda sobre el tema que toca hoy.
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/14 bg-black/20 p-5 text-white backdrop-blur-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Familia</div>
                  <div className="mt-2 text-lg font-bold">Acompaña sin invadir</div>
                  <p className="mt-2 text-sm leading-6 text-white/78">
                    Varios alumnos por familia, accesos separados y contexto compartido con permisos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Qué se siente distinto</div>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              Mentoría entra como un aula guiada, no como un panel con IA encima.
            </h2>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {strengths.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <item.icon className="h-7 w-7 text-emerald-700" />
                <h3 className="mt-4 text-xl font-bold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-slate-50 px-6 py-20 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-800">
              <ShieldCheck className="h-4 w-4" />
              Accesos separados
            </div>
            <h2 className="mt-5 text-4xl font-black tracking-tight text-slate-950">Un mismo ecosistema, dos entradas claras.</h2>
            <p className="mt-4 text-base leading-8 text-slate-600">
              El alumno entra a estudiar. El padre o tutor entra a acompañar y organizar. Los perfiles están vinculados, pero la experiencia no se mezcla.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/mentorias/auths/logins?role=student&__drako_host=mentoria.drako.systems"
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-black"
              >
                Acceso alumno
              </Link>
              <Link
                href="/mentorias/auths/logins?role=guardian&__drako_host=mentoria.drako.systems"
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                Acceso padres y tutores
              </Link>
            </div>
          </div>

          <div className="grid gap-3">
            {useCases.map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm leading-7 text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
