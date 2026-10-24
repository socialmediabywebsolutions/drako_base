"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { ProductAuthForm } from "@/components/auth/product-auth-form";

const mentoriaAuthCopy = {
  loginTab: "Entrar",
  registerTab: "Crear acceso",
  nameLabel: "Nombre",
  emailLabel: "Email",
  passwordLabel: "Contraseña",
  namePlaceholder: "Marta Ruiz",
  emailPlaceholder: "familia@email.com",
  passwordPlaceholder: "********",
  loadingLabel: "Preparando acceso...",
  loginSubmit: "Entrar a Mentoría",
  registerSubmit: "Crear acceso de familia",
} as const;

export default function MentoriasRegistrationsPage() {
  const searchParams = useSearchParams();
  const redirect = useMemo(() => {
    const params = new URLSearchParams();
    const ref = searchParams.get("ref");
    const invite = searchParams.get("invite");
    const relation = searchParams.get("relation");
    if (ref) params.set("ref", ref);
    if (invite) params.set("invite", invite);
    if (relation) params.set("relation", relation);
    const suffix = params.toString();
    return suffix ? `/mentoria/onboarding?${suffix}` : "/mentoria/onboarding";
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-8 lg:grid-cols-[0.95fr_0.7fr] lg:items-center lg:px-8">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
            <Users className="h-4 w-4" />
            Familia
          </div>
          <div className="max-w-3xl">
            <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl">Crea el acceso de la familia</h1>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Primero entra el tutor principal. Después configuramos alumnos, estructura familiar y el arranque real de Mentoría sin meter ruido innecesario.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-6">
            <div className="text-sm font-semibold text-white">Qué pasa después</div>
            <div className="mt-3 space-y-2 text-sm leading-7 text-slate-200">
              <div>1. Definís quién acompaña y qué alumno empieza primero.</div>
              <div>2. Dejáis curso real, materias y base académica sin hacer un formulario eterno.</div>
              <div>3. La familia entra a su espacio y cada alumno queda listo para su propia pizarra.</div>
            </div>
          </div>

          <Link href="/mentorias/auths/logins?role=guardian&__drako_host=mentoria.drako.systems" className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            Ya tengo acceso
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="flex justify-center lg:justify-end">
          <ProductAuthForm
            title="Alta del tutor principal"
            description="Este acceso abre el onboarding familiar y deja vinculados tutores y alumnos dentro del mismo ecosistema."
            authApiBase="/api/mentorias/auths"
            defaultMode="register"
            postLoginRedirect={redirect}
            copy={mentoriaAuthCopy}
            registerSelectField={{
              name: "relation",
              label: "Relación",
              defaultValue: "tutor",
              options: [
                { value: "mother", label: "Madre" },
                { value: "father", label: "Padre" },
                { value: "tutor", label: "Tutor legal" },
              ],
            }}
          />
        </section>
      </div>
    </div>
  );
}
