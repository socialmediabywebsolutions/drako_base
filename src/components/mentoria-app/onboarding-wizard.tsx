"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, Loader2, Plus, X } from "lucide-react";
import { getWorkspaceUiCopy, MENTORIA_SCHOOL_YEAR_OPTIONS } from "@/lib/mentoria/microcopy";
import type {
  MentoriaFamilyStructure,
  MentoriaGuardian,
  MentoriaGuardianRole,
  MentoriaLearningStage,
  MentoriaOnboardingPayload,
  MentoriaOnboardingPrimaryGuardian,
  MentoriaOnboardingSecondaryGuardian,
  MentoriaOnboardingState,
  MentoriaOnboardingSubjectInput,
  MentoriaRepeatedCourseStatus,
  MentoriaStudentSupportNeed,
  MentoriaSubject,
  MentoriaSupportStyle,
} from "@/lib/mentoria/types";

type SubjectChoice = MentoriaOnboardingSubjectInput;

type AdditionalStudentDraft = {
  fullName: string;
  stage: MentoriaLearningStage;
  schoolYear: string;
  age: string;
};

type OnboardingDraft = {
  familyStructure: MentoriaFamilyStructure;
  primaryGuardian: MentoriaOnboardingPrimaryGuardian;
  secondaryGuardian: MentoriaOnboardingSecondaryGuardian & { email: string };
  student: {
    fullName: string;
    stage: MentoriaLearningStage;
    schoolYear: string;
    age: string;
    repeatedCourseStatus: MentoriaRepeatedCourseStatus | null;
    repeatedCourseYears: string;
    subjects: SubjectChoice[];
    supportNeeds: MentoriaStudentSupportNeed[];
    supportStyle: MentoriaSupportStyle | null;
  };
  additionalStudents: AdditionalStudentDraft[];
};

type OnboardingValidation = {
  valid: boolean;
  message: string | null;
};

type SearchParamReader = {
  get(name: string): string | null;
};

const STORAGE_KEY = "mentoria-onboarding-activation-v5";
const TOTAL_STEPS = 3;
const DEFAULT_STAGE: MentoriaLearningStage = "eso";

const RELATION_OPTIONS: Array<{ value: MentoriaGuardianRole; label: string }> = [
  { value: "mother", label: "Madre" },
  { value: "father", label: "Padre" },
  { value: "tutor", label: "Tutor legal" },
];

const FAMILY_STRUCTURE_OPTIONS: Array<{ value: MentoriaFamilyStructure; title: string; text: string }> = [
  { value: "single_guardian", title: "Un solo tutor", text: "Una persona acompana y gestiona el espacio." },
  { value: "two_guardians", title: "Dos tutores", text: "Dos adultos coordinan el seguimiento." },
  { value: "separated_parents", title: "Padres separados", text: "Cada tutor puede entrar y ver al alumno sin mezclar el contexto." },
  { value: "legal_guardian", title: "Otro tutor legal", text: "Tutor, familiar o responsable legal." },
];

const STAGE_OPTIONS: Array<{ value: MentoriaLearningStage; label: string }> = [
  { value: "primary", label: "Primaria" },
  { value: "eso", label: "ESO" },
  { value: "bachillerato", label: "Bachillerato" },
];

const REPEATED_COURSE_OPTIONS: Array<{ value: MentoriaRepeatedCourseStatus; title: string; text: string }> = [
  { value: "never", title: "No ha repetido", text: "Su recorrido ha seguido el curso esperado." },
  { value: "before", title: "Ha repetido antes", text: "Ya hubo una repeticion en algun curso anterior." },
  { value: "current", title: "Repite ahora", text: "Actualmente esta rehaciendo el curso." },
];

const SUPPORT_NEED_OPTIONS: Array<{ value: MentoriaStudentSupportNeed; title: string; text: string }> = [
  { value: "base_gap", title: "Falta de base", text: "Necesita reconstruir ideas que no quedaron solidas." },
  { value: "frustration", title: "Se frustra rapido", text: "Se bloquea cuando algo no sale pronto." },
  { value: "organization", title: "Le cuesta organizarse", text: "Necesita orden para empezar y sostenerse." },
  { value: "study_habit", title: "Falta de habito", text: "Necesita rutina y continuidad real." },
  { value: "attention", title: "Pierde foco", text: "Le cuesta mantener la atencion durante el bloque." },
  { value: "exam_anxiety", title: "Se tensa con examenes", text: "Necesita bajar ansiedad y entrar con seguridad." },
];

const SUPPORT_STYLE_OPTIONS: Array<{ value: MentoriaSupportStyle; title: string; text: string }> = [
  { value: "step_by_step", title: "Paso a paso", text: "Desglose claro, sin saltos y con una guia constante." },
  { value: "visual_steps", title: "Visual y por bloques", text: "Ideas cortas, ordenadas y faciles de seguir." },
  { value: "concrete_example", title: "Con ejemplos concretos", text: "Primero un ejemplo cercano y despues la regla." },
  { value: "guided_practice", title: "Practica guiada", text: "Aprende haciendo con apoyo del tutor." },
  { value: "retrieval_check", title: "Comprobaciones cortas", text: "Le ayuda recordar y verificar en tramos breves." },
];

const EMPTY_DRAFT: OnboardingDraft = {
  familyStructure: "single_guardian",
  primaryGuardian: {
    fullName: "",
    relation: "tutor",
  },
  secondaryGuardian: {
    fullName: "",
    relation: "father",
    email: "",
  },
  student: {
    fullName: "",
    stage: DEFAULT_STAGE,
    schoolYear: "",
    age: "",
    repeatedCourseStatus: null,
    repeatedCourseYears: "",
    subjects: [],
    supportNeeds: [],
    supportStyle: null,
  },
  additionalStudents: [],
};

function isGuardianRole(value: string | null): value is MentoriaGuardianRole {
  return value === "mother" || value === "father" || value === "tutor";
}

function deriveStageFromSchoolYear(schoolYear: string): MentoriaLearningStage {
  const normalized = schoolYear.toLowerCase().trim();
  if (normalized.includes("primaria")) return "primary";
  if (normalized.includes("bach")) return "bachillerato";
  return "eso";
}

function inferAgeFromSchoolYear(schoolYear: string): string {
  const normalized = schoolYear.toLowerCase().trim();
  if (normalized === "1 primaria") return "6";
  if (normalized === "2 primaria") return "7";
  if (normalized === "3 primaria") return "8";
  if (normalized === "4 primaria") return "9";
  if (normalized === "5 primaria") return "10";
  if (normalized === "6 primaria") return "11";
  if (normalized === "1 eso") return "12";
  if (normalized === "2 eso") return "13";
  if (normalized === "3 eso") return "14";
  if (normalized === "4 eso") return "15";
  if (normalized === "1 bachillerato") return "16";
  if (normalized === "2 bachillerato") return "17";
  return "";
}

function getSchoolYearOptions(stage: MentoriaLearningStage): string[] {
  if (stage === "primary") return MENTORIA_SCHOOL_YEAR_OPTIONS.filter((year) => year.toLowerCase().includes("primaria"));
  if (stage === "bachillerato") return MENTORIA_SCHOOL_YEAR_OPTIONS.filter((year) => year.toLowerCase().includes("bach"));
  return MENTORIA_SCHOOL_YEAR_OPTIONS.filter((year) => year.toLowerCase().includes("eso"));
}

function getFallbackSubjects(stage: MentoriaLearningStage): MentoriaSubject[] {
  return getWorkspaceUiCopy(stage).fallbackSubjects.map(
    (subject) =>
      ({
        id: subject.slug,
        tenantId: "",
        slug: subject.slug,
        name: subject.label,
        description: "",
        difficultyBand: "core",
        createdAt: "",
        updatedAt: "",
      }) as MentoriaSubject,
  );
}

function buildMentoriaWorkspaceUrl(searchParams: SearchParamReader): string {
  const target = new URL("/mentoria/app/parents", window.location.origin);
  const localOverrideHost = searchParams.get("__drako_host")?.trim();
  const hostname = window.location.hostname.toLowerCase();
  if (localOverrideHost) {
    target.searchParams.set("__drako_host", localOverrideHost);
  } else if (hostname === "localhost" || hostname === "127.0.0.1") {
    target.searchParams.set("__drako_host", "mentoria.drako.systems");
  } else if (
    hostname !== "mentoria.drako.systems"
    && hostname !== "mentorias.drako.systems"
    && !hostname.startsWith("mentoria.")
    && !hostname.startsWith("mentorias.")
  ) {
    target.protocol = "https:";
    target.hostname = "mentoria.drako.systems";
    target.port = "";
  }
  return target.toString();
}

function isSecondaryGuardianExpected(familyStructure: MentoriaFamilyStructure) {
  return familyStructure === "two_guardians";
}

function hasSecondaryGuardianDraft(draft: OnboardingDraft) {
  return Boolean(draft.secondaryGuardian.fullName.trim() || draft.secondaryGuardian.email.trim());
}

function parseRepeatedCourseStatus(supportNotes?: string): MentoriaRepeatedCourseStatus | null {
  if (!supportNotes) return null;
  if (supportNotes.includes("repite actualmente")) return "current";
  if (supportNotes.includes("ha repetido antes")) return "before";
  if (supportNotes.includes("no ha repetido")) return "never";
  return null;
}

function parseSupportNeeds(supportNotes?: string): MentoriaStudentSupportNeed[] {
  if (!supportNotes) return [];
  return SUPPORT_NEED_OPTIONS.filter((option) => supportNotes.includes(option.text.toLowerCase()) || supportNotes.includes(option.title.toLowerCase())).map((option) => option.value);
}

function parseSupportStyle(supportNotes?: string): MentoriaSupportStyle | null {
  if (!supportNotes) return null;
  const match = SUPPORT_STYLE_OPTIONS.find((option) => supportNotes.includes(option.title.toLowerCase()) || supportNotes.includes(option.text.toLowerCase()));
  return match?.value ?? null;
}

function getStepValidation(step: number, draft: OnboardingDraft): OnboardingValidation {
  if (step === 1) {
    if (!draft.primaryGuardian.fullName.trim()) return { valid: false, message: "Escribe el nombre del tutor principal." };
    if (!draft.primaryGuardian.relation) return { valid: false, message: "Indica que relacion tiene el tutor principal." };
    if (isSecondaryGuardianExpected(draft.familyStructure) && !draft.secondaryGuardian.fullName.trim()) {
      return { valid: false, message: "Anade el nombre del segundo tutor o cambia la estructura familiar." };
    }
    if (isSecondaryGuardianExpected(draft.familyStructure) && !draft.secondaryGuardian.email.trim()) {
      return { valid: false, message: "Anade el email del segundo tutor para conectarlo al espacio." };
    }
    if (hasSecondaryGuardianDraft(draft) && !draft.secondaryGuardian.fullName.trim()) {
      return { valid: false, message: "Escribe el nombre del segundo tutor." };
    }
    if (draft.secondaryGuardian.email.trim() && !draft.secondaryGuardian.email.includes("@")) {
      return { valid: false, message: "Revisa el email del segundo tutor." };
    }
    if (!draft.student.fullName.trim()) return { valid: false, message: "Escribe el nombre del alumno." };
    if (draft.additionalStudents.some((student) => student.fullName.trim() && !student.schoolYear.trim())) {
      return { valid: false, message: "Completa el curso de cada alumno adicional o elimínalo antes de seguir." };
    }
    return { valid: true, message: null };
  }

  if (step === 2) {
    if (!draft.student.schoolYear.trim()) return { valid: false, message: "Selecciona el curso real del alumno." };
    if (draft.student.repeatedCourseStatus === null) return { valid: false, message: "Indica si ha repetido curso." };
    if (draft.student.subjects.length === 0) return { valid: false, message: "Selecciona al menos una materia real." };
    return { valid: true, message: null };
  }

  if (step === 3) {
    if (draft.student.supportNeeds.length === 0) return { valid: false, message: "Selecciona al menos una necesidad de apoyo real." };
    if (!draft.student.supportStyle) return { valid: false, message: "Elige como conviene que Mentoria arranque con este alumno." };
    return { valid: true, message: null };
  }

  return { valid: true, message: null };
}

function buildOnboardingPayload(draft: OnboardingDraft, subjects: MentoriaSubject[], searchParams: SearchParamReader): MentoriaOnboardingPayload {
  const selectedSubjects: SubjectChoice[] = draft.student.subjects.length > 0
    ? draft.student.subjects
    : (() => {
        const fallback = subjects[0] ?? getFallbackSubjects(DEFAULT_STAGE)[0];
        return fallback ? [{ subjectSlug: fallback.slug, initialLevel: "me_cuesta_mucho" }] : [];
      })();
  const secondaryGuardian = hasSecondaryGuardianDraft(draft)
    ? {
        fullName: draft.secondaryGuardian.fullName.trim(),
        relation: draft.secondaryGuardian.relation,
        ...(draft.secondaryGuardian.email.trim() ? { email: draft.secondaryGuardian.email.trim() } : {}),
      }
    : null;

  return {
    primaryGuardian: {
      fullName: draft.primaryGuardian.fullName.trim(),
      relation: draft.primaryGuardian.relation,
    },
    secondaryGuardian,
    familyStructure: draft.familyStructure,
    student: {
      fullName: draft.student.fullName.trim(),
      stage: draft.student.stage,
      schoolYear: draft.student.schoolYear,
      age: Number(draft.student.age || inferAgeFromSchoolYear(draft.student.schoolYear)),
      repeatedCourseStatus: draft.student.repeatedCourseStatus ?? "never",
      repeatedCourseYears: draft.student.repeatedCourseYears
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      subjects: selectedSubjects,
      supportNeeds: draft.student.supportNeeds,
      supportStyle: draft.student.supportStyle ?? "step_by_step",
    },
    additionalStudents: draft.additionalStudents
      .filter((student) => student.fullName.trim())
      .map((student) => ({
        fullName: student.fullName.trim(),
        stage: student.stage,
        schoolYear: student.schoolYear.trim(),
        age: Number(student.age || inferAgeFromSchoolYear(student.schoolYear)),
      })),
    referralCode: searchParams.get("ref") ?? undefined,
    inviteToken: searchParams.get("invite") ?? undefined,
  };
}

function StepBadge({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Paso ${current} de ${TOTAL_STEPS}`}>
      {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map((step) => (
        <div
          key={step}
          className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${step <= current ? "bg-emerald-600" : "bg-slate-200"}`}
        />
      ))}
    </div>
  );
}

function ChoiceButton({ selected, onClick, title, text }: { selected: boolean; onClick: () => void; title: string; text?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[72px] rounded-lg border px-4 py-3 text-left text-sm transition-colors duration-200 ${selected ? "border-emerald-600 bg-emerald-50 text-emerald-950" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"}`}
    >
      <span className="flex items-center justify-between gap-3 font-semibold">
        {title}
        {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
      </span>
      {text ? <span className="mt-1 block leading-5 text-slate-500">{text}</span> : null}
    </button>
  );
}

export function MentoriaOnboardingWizard() {
  const searchParams = useSearchParams();
  const relationParamValue = searchParams.get("relation");
  const relationParam = isGuardianRole(relationParamValue) ? relationParamValue : null;
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({
    ...EMPTY_DRAFT,
    primaryGuardian: {
      ...EMPTY_DRAFT.primaryGuardian,
      relation: relationParam ?? EMPTY_DRAFT.primaryGuardian.relation,
    },
  }));
  const [subjects, setSubjects] = useState<MentoriaSubject[]>([]);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schoolYearOptions = useMemo(() => getSchoolYearOptions(draft.student.stage), [draft.student.stage]);
  const subjectOptions = useMemo(() => (subjects.length > 0 ? subjects : getFallbackSubjects(draft.student.stage)), [draft.student.stage, subjects]);

  useEffect(() => {
    const local = window.localStorage.getItem(STORAGE_KEY);
    if (local) {
      try {
        const parsed = JSON.parse(local) as Partial<OnboardingDraft>;
        if (parsed && typeof parsed === "object") {
          setDraft((current) => ({
            ...current,
            ...parsed,
            primaryGuardian: {
              ...current.primaryGuardian,
              ...parsed.primaryGuardian,
              relation: parsed.primaryGuardian?.relation ?? (relationParam ?? current.primaryGuardian.relation),
            },
            secondaryGuardian: {
              ...current.secondaryGuardian,
              ...parsed.secondaryGuardian,
              email: parsed.secondaryGuardian?.email ?? current.secondaryGuardian.email,
            },
            student: {
              ...current.student,
              ...parsed.student,
            },
            additionalStudents: Array.isArray(parsed.additionalStudents) ? parsed.additionalStudents : current.additionalStudents,
          }));
        }
      } catch {
        undefined;
      }
    }

    void (async () => {
      try {
        const response = await fetch("/api/mentoria/onboarding", { cache: "no-store" });
        if (!response || typeof response.json !== "function") return;
        if (response.status === 401) {
          window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/onboarding";
          return;
        }
        const body = (await response.json().catch(() => null)) as ({ ok?: boolean; error?: string } & Partial<MentoriaOnboardingState>) | null;
        if (!body || !response.ok) {
          setError(body?.error ?? "No hemos podido cargar el onboarding.");
          return;
        }
        setSessionEmail(body.sessionEmail ?? searchParams.get("email"));
        setSubjects(body.subjects && body.subjects.length > 0 ? body.subjects : getFallbackSubjects(DEFAULT_STAGE));
        if (body.primaryGuardian) {
          setDraft((current) => ({
            ...current,
            primaryGuardian: {
              fullName: current.primaryGuardian.fullName || body.primaryGuardian?.fullName || "",
              relation: body.primaryGuardian?.relation ?? (relationParam ?? current.primaryGuardian.relation),
            },
          }));
        }
        const secondaryGuardian = (body.secondaryGuardians?.[0] ?? null) as MentoriaGuardian | null;
        if (secondaryGuardian) {
          setDraft((current) => ({
            ...current,
            familyStructure: body.secondaryGuardians && body.secondaryGuardians.length > 0 ? "two_guardians" : current.familyStructure,
            secondaryGuardian: {
              fullName: secondaryGuardian.name ?? "",
              relation: secondaryGuardian.familyRelation,
              email: secondaryGuardian.email ?? "",
            },
          }));
        }
        const currentStudent = body.student ?? body.profile ?? null;
        if (currentStudent?.onboardingCompleted) {
          window.location.href = buildMentoriaWorkspaceUrl(searchParams);
          return;
        }
        if (currentStudent) {
          const studentSubjects = body.studentSubjects ?? [];
          setDraft((current) => ({
            ...current,
            student: {
              ...current.student,
              fullName: currentStudent.fullName,
              stage: currentStudent.learningStage,
              schoolYear: currentStudent.schoolYear,
              age: String(currentStudent.age ?? inferAgeFromSchoolYear(currentStudent.schoolYear)),
              repeatedCourseStatus: parseRepeatedCourseStatus(currentStudent.supportNotes),
              repeatedCourseYears: "",
              subjects: current.student.subjects.length > 0 ? current.student.subjects : studentSubjects.map((item) => ({ subjectSlug: item.subject?.slug ?? "", initialLevel: item.initialLevel })),
              supportNeeds: current.student.supportNeeds.length > 0 ? current.student.supportNeeds : parseSupportNeeds(currentStudent.supportNotes),
              supportStyle: current.student.supportStyle ?? parseSupportStyle(currentStudent.supportNotes),
            },
          }));
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No hemos podido cargar el onboarding.");
      } finally {
        setLoading(false);
      }
    })();
  }, [relationParam, searchParams]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  async function finish() {
    const blockingStep = [1, 2, 3].map((candidateStep) => getStepValidation(candidateStep, draft)).find((validation) => !validation.valid);
    if (blockingStep) {
      setError(blockingStep.message ?? "Completa este paso para seguir.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/mentoria/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildOnboardingPayload(draft, subjectOptions, searchParams)),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "No hemos podido preparar el espacio.");
        return;
      }
      window.localStorage.removeItem(STORAGE_KEY);
      window.location.href = buildMentoriaWorkspaceUrl(searchParams);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No hemos podido preparar el espacio.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-8 text-sm text-slate-600">Preparando Mentoria...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <main className="mx-auto max-w-5xl">
        <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Mentoria familiar</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Alta corta para empezar hoy</h1>
          </div>
          <div className="w-full sm:w-64">
            <StepBadge current={step} />
            <p className="mt-2 text-right text-xs font-semibold text-slate-500">{`Paso ${step} de ${TOTAL_STEPS}`}</p>
          </div>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          {error ? <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          {step === 1 ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Quienes sois</h2>
                <p className="mt-1 text-sm text-slate-600">Dejamos clara la familia y con qué alumno vais a empezar.</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Tutor principal</label>
                  <input
                    value={draft.primaryGuardian.fullName}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, primaryGuardian: { ...current.primaryGuardian, fullName: event.target.value } }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Nombre del tutor principal"
                  />
                  {sessionEmail ? <p className="mt-2 text-xs text-slate-500">{`Acceso: ${sessionEmail}`}</p> : null}
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Relacion</label>
                  <div className="grid grid-cols-3 gap-2">
                    {RELATION_OPTIONS.map((option) => (
                      <ChoiceButton key={option.value} title={option.label} selected={draft.primaryGuardian.relation === option.value} onClick={() => setDraft((current) => ({ ...current, primaryGuardian: { ...current.primaryGuardian, relation: option.value } }))} />
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Estructura familiar</label>
                <div className="grid gap-3 md:grid-cols-2">
                  {FAMILY_STRUCTURE_OPTIONS.map((option) => (
                    <ChoiceButton
                      key={option.value}
                      title={option.title}
                      text={option.text}
                      selected={draft.familyStructure === option.value}
                      onClick={() => setDraft((current) => ({ ...current, familyStructure: option.value, primaryGuardian: { ...current.primaryGuardian, relation: option.value === "legal_guardian" ? "tutor" : current.primaryGuardian.relation } }))}
                    />
                  ))}
                </div>
              </div>

              {draft.familyStructure === "two_guardians" || draft.familyStructure === "separated_parents" ? (
                <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_1fr]">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{draft.familyStructure === "two_guardians" ? "Segundo tutor" : "Segundo tutor opcional"}</label>
                    <input
                      value={draft.secondaryGuardian.fullName}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, secondaryGuardian: { ...current.secondaryGuardian, fullName: event.target.value } }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Nombre del segundo tutor"
                    />
                    <input
                      value={draft.secondaryGuardian.email}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, secondaryGuardian: { ...current.secondaryGuardian, email: event.target.value } }))}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder={draft.familyStructure === "two_guardians" ? "Email del segundo tutor" : "Email del segundo tutor (opcional)"}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Relacion</label>
                    <div className="grid grid-cols-3 gap-2">
                      {RELATION_OPTIONS.map((option) => (
                        <ChoiceButton key={option.value} title={option.label} selected={draft.secondaryGuardian.relation === option.value} onClick={() => setDraft((current) => ({ ...current, secondaryGuardian: { ...current.secondaryGuardian, relation: option.value } }))} />
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Alumno con el que empezais</label>
                <input
                  value={draft.student.fullName}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, student: { ...current.student, fullName: event.target.value } }))}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Nombre del alumno/a"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Otros alumnos vinculados</div>
                    <p className="mt-1 text-sm text-slate-600">Si hay más hijos en Mentoria, puedes dejarlos preparados ya.</p>
                  </div>
                  <button type="button" onClick={() => setDraft((current) => ({ ...current, additionalStudents: [...current.additionalStudents, { fullName: "", stage: DEFAULT_STAGE, schoolYear: "", age: "" }] }))} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-white">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Anadir alumno
                  </button>
                </div>
                <div className="mt-4 space-y-3">
                  {draft.additionalStudents.map((student, index) => (
                    <div key={`${index}-${student.fullName}`} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[1.2fr_0.8fr_0.8fr_auto]">
                      <input value={student.fullName} onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, additionalStudents: current.additionalStudents.map((item, itemIndex) => itemIndex === index ? { ...item, fullName: event.target.value } : item) }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Nombre del alumno" />
                      <input value={student.schoolYear} onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, additionalStudents: current.additionalStudents.map((item, itemIndex) => itemIndex === index ? { ...item, schoolYear: event.target.value, stage: deriveStageFromSchoolYear(event.target.value) } : item) }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Curso" />
                      <input value={student.age} onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, additionalStudents: current.additionalStudents.map((item, itemIndex) => itemIndex === index ? { ...item, age: event.target.value } : item) }))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Edad (opcional)" />
                      <button type="button" onClick={() => setDraft((current) => ({ ...current, additionalStudents: current.additionalStudents.filter((_item, itemIndex) => itemIndex !== index) }))} className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-slate-500 hover:bg-slate-50">
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Donde esta hoy</h2>
                <p className="mt-1 text-sm text-slate-600">Etapa, curso real, repeticion y materias con las que vamos a trabajar.</p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Etapa</label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {STAGE_OPTIONS.map((option) => (
                    <ChoiceButton
                      key={option.value}
                      title={option.label}
                      selected={draft.student.stage === option.value}
                      onClick={() => setDraft((current) => ({ ...current, student: { ...current.student, stage: option.value, schoolYear: getSchoolYearOptions(option.value).includes(current.student.schoolYear) ? current.student.schoolYear : "" } }))}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Curso real</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {schoolYearOptions.map((year) => (
                      <ChoiceButton
                        key={year}
                        title={year}
                        selected={draft.student.schoolYear === year}
                        onClick={() => setDraft((current) => ({ ...current, student: { ...current.student, schoolYear: year, age: current.student.age || inferAgeFromSchoolYear(year) } }))}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Edad real (opcional)</label>
                  <input
                    value={draft.student.age}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, student: { ...current.student, age: event.target.value } }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Edad real del alumno"
                    inputMode="numeric"
                  />
                  <p className="mt-2 text-xs text-slate-500">Si no la escribes ahora, la estimamos desde el curso para no frenarte.</p>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Repeticion de curso</label>
                <div className="grid gap-3 md:grid-cols-3">
                  {REPEATED_COURSE_OPTIONS.map((option) => (
                    <ChoiceButton key={option.value} title={option.title} text={option.text} selected={draft.student.repeatedCourseStatus === option.value} onClick={() => setDraft((current) => ({ ...current, student: { ...current.student, repeatedCourseStatus: option.value } }))} />
                  ))}
                </div>
                {draft.student.repeatedCourseStatus && draft.student.repeatedCourseStatus !== "never" ? (
                  <input
                    value={draft.student.repeatedCourseYears}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft((current) => ({ ...current, student: { ...current.student, repeatedCourseYears: event.target.value } }))}
                    className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Si quieres, anade cursos separados por coma"
                  />
                ) : null}
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Materias que necesitan acompanamiento</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {subjectOptions.map((subject) => {
                    const selected = draft.student.subjects.some((item) => item.subjectSlug === subject.slug);
                    return (
                      <ChoiceButton
                        key={subject.slug}
                        title={subject.name}
                        selected={selected}
                        onClick={() => setDraft((current) => ({
                          ...current,
                          student: {
                            ...current.student,
                            subjects: selected
                              ? current.student.subjects.filter((item) => item.subjectSlug !== subject.slug)
                              : [...current.student.subjects, { subjectSlug: subject.slug, initialLevel: "me_cuesta_mucho" }],
                          },
                        }))}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Base de arranque</h2>
                <p className="mt-1 text-sm text-slate-600">Marcamos bloqueos reales y la forma de ayuda que mejor encaja. No es el estado del dia; es la base estable con la que debe empezar Mentoria.</p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Necesidades de apoyo</label>
                <div className="grid gap-3 md:grid-cols-2">
                  {SUPPORT_NEED_OPTIONS.map((option) => {
                    const selected = draft.student.supportNeeds.includes(option.value);
                    return (
                      <ChoiceButton
                        key={option.value}
                        title={option.title}
                        text={option.text}
                        selected={selected}
                        onClick={() => setDraft((current) => ({
                          ...current,
                          student: {
                            ...current.student,
                            supportNeeds: selected
                              ? current.student.supportNeeds.filter((item) => item !== option.value)
                              : [...current.student.supportNeeds, option.value],
                          },
                        }))}
                      />
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Como conviene empezar</label>
                <div className="grid gap-3 md:grid-cols-2">
                  {SUPPORT_STYLE_OPTIONS.map((option) => (
                    <ChoiceButton key={option.value} title={option.title} text={option.text} selected={draft.student.supportStyle === option.value} onClick={() => setDraft((current) => ({ ...current, student: { ...current.student, supportStyle: option.value } }))} />
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button type="button" onClick={() => { setError(null); setStep((current) => Math.max(1, current - 1)); }} className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500" disabled={saving}>
                Volver
              </button>
            ) : <span />}

            {step < TOTAL_STEPS ? (
              <button type="button" onClick={() => { const validation = getStepValidation(step, draft); if (validation.valid) { setError(null); setStep((current) => Math.min(TOTAL_STEPS, current + 1)); } else { setError(validation.message ?? "Completa este paso para seguir."); } }} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                Continuar
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button type="button" disabled={saving} onClick={finish} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Preparar espacio
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
