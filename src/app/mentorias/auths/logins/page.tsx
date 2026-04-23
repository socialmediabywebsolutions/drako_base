"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, Users } from "lucide-react";
import { ProductAuthForm } from "@/components/auth/product-auth-form";

const mentoriaAuthCopy = {
  loginTab: "Entrar",
  registerTab: "Crear acceso",
  nameLabel: "Nombre",
  emailLabel: "Email",
  passwordLabel: "Contraseña",
  namePlaceholder: "Marta Ruiz",
  emailPlaceholder: "tu@email.com",
  passwordPlaceholder: "********",
  loadingLabel: "Entrando...",
  loginSubmit: "Entrar a Mentoría",
  registerSubmit: "Crear acceso",
} as const;

export default function MentoriasLoginsPage() {
  const searchParams = useSearchParams();
  const role = searchParams.get("role") === "student" ? "student" : "guardian";
  const isStudent = role === "student";
  const title = isStudent ? "Acceso de alumno" : "Acceso de padres y tutores";
  const description = isStudent
    ? "Entra a tu pizarra, retoma tu materia y habla con tu tutor IA sin ruido alrededor."
    : "Entra al espacio de familia, revisa a tus alumnos vinculados y acompaña sin mezclar perfiles.";
  const redirect = isStudent ? "/mentoria/app" : "/mentoria/app/parents";
  const accentCard = isStudent
    ? {
        icon: BookOpen,
        eyebrow: "Alumno",
        heading: "Tu clase guiada empieza aquí",
        body: "Haz una pregunta, trae una duda del cole o retoma lo que estabas estudiando. La pizarra manda y el tutor acompaña.",
      }
    : {
        icon: Users,
        eyebrow: "Familia",
        heading: "Tu espacio es distinto al del alumno",
        body: "Aquí entras a ver a tus hijos vinculados, organizar acompañamiento y abrir la vista de cada alumno cuando toque.",
      };

  const callbackLink = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("role", isStudent ? "guardian" : "student");
    const suffix = params.toString();
    return `/mentorias/auths/logins${suffix ? `?${suffix}` : ""}`;
  }, [isStudent, searchParams]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-10 px-6 py-8 lg:grid-cols-[0.95fr_0.7fr] lg:items-center lg:px-8">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
            <accentCard.icon className="h-4 w-4" />
            {accentCard.eyebrow}
          </div>
          <div className="max-w-3xl">
            <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl">{title}</h1>
            <p className="mt-5 text-lg leading-8 text-slate-300">{accentCard.body}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              href="/mentorias/auths/logins?role=student&__drako_host=mentoria.drako.systems"
              className={`rounded-2xl border px-5 py-5 transition ${isStudent ? "border-emerald-300 bg-emerald-400/12 text-white" : "border-white/12 bg-white/6 text-slate-200 hover:bg-white/10"}`}
            >
              <div className="text-sm font-semibold">Entrar como alumno</div>
              <div className="mt-2 text-sm leading-6 text-slate-300">Pizarra, tutor flotante y trabajo actual.</div>
            </Link>
            <Link
              href="/mentorias/auths/logins?role=guardian&__drako_host=mentoria.drako.systems"
              className={`rounded-2xl border px-5 py-5 transition ${!isStudent ? "border-emerald-300 bg-emerald-400/12 text-white" : "border-white/12 bg-white/6 text-slate-200 hover:bg-white/10"}`}
            >
              <div className="text-sm font-semibold">Entrar como padre o tutor</div>
              <div className="mt-2 text-sm leading-6 text-slate-300">Familia, alumnos vinculados y seguimiento sin invadir.</div>
            </Link>
          </div>

          {!isStudent ? (
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-5 text-sm leading-7 text-emerald-50">
              Alta inicial de familia y alumnos en pocos pasos. Después cada alumno vive su propia experiencia.
              <div className="mt-4">
                <Link href="/mentorias/auths/registrations?__drako_host=mentoria.drako.systems" className="inline-flex items-center gap-2 font-semibold text-white">
                  Crear acceso de familia
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-sky-300/20 bg-sky-400/10 p-5 text-sm leading-7 text-sky-50">
              El acceso de alumno usa credenciales ya activadas para ese perfil. Si aún no las tienes, entra como padre o tutor para gestionar la familia.
              <div className="mt-4">
                <Link href={callbackLink} className="inline-flex items-center gap-2 font-semibold text-white">
                  Cambiar a acceso de familia
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </section>

        <section className="flex justify-center lg:justify-end">
          <ProductAuthForm
            title={title}
            description={description}
            authApiBase="/api/mentorias/auths"
            defaultMode="login"
            allowRegister={!isStudent}
            postLoginRedirect={redirect}
            copy={mentoriaAuthCopy}
          />
        </section>
      </div>
    </div>
  );
}
