"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { getWorkspaceUiCopy, MENTORIA_SCHOOL_YEAR_OPTIONS } from "@/lib/mentoria/microcopy";
import type {
  MentoriaFamilyStructure,
  MentoriaGuardian,
  MentoriaGuardianRole,
  MentoriaInitialPriority,
  MentoriaLearningStage,
  MentoriaOnboardingPayload,
  MentoriaOnboardingPrimaryGuardian,
  MentoriaOnboardingSecondaryGuardian,
  MentoriaOnboardingState,
  MentoriaOnboardingSubjectInput,
  MentoriaSubject,
} from "@/lib/mentoria/types";

type OnboardingObjective = MentoriaOnboardingPayload["goal"];
type ConfidenceLabel = MentoriaOnboardingPayload["confidenceLevel"];
type PriorityDraftValue = MentoriaInitialPriority | "";

type SubjectChoice = MentoriaOnboardingSubjectInput;

type OnboardingDraft = {
  familyStructure: MentoriaFamilyStructure;
  primaryGuardian: MentoriaOnboardingPrimaryGuardian;
  secondaryGuardian: MentoriaOnboardingSecondaryGuardian & { email: string };
  student: {
    fullName: string;
    stage: MentoriaLearningStage;
    schoolYear: string;
    hasRepeatedCourse: boolean | null;
    subjects: SubjectChoice[];
    initialPriority: PriorityDraftValue;
    confidenceLevel: ConfidenceLabel;
  };
};

type OnboardingValidation = {
  valid: boolean;
  message: string | null;
};

type SearchParamReader = {
  get(name: string): string | null;
};

const STORAGE_KEY = "mentoria-onboarding-activation-v3";
const TOTAL_STEPS = 3;
const DEFAULT_STAGE: MentoriaLearningStage = "eso";

const RELATION_OPTIONS: Array<{ value: MentoriaGuardianRole; label: string }> = [
  { value: "mother", label: "Madre" },
  { value: "father", label: "Padre" },
  { value: "tutor", label: "Tutor legal" },
];

const FAMILY_STRUCTURE_OPTIONS: Array<{
  value: MentoriaFamilyStructure;
  title: string;
  text: string;
}> = [
  { value: "single_guardian", title: "Un solo tutor", text: "Una persona acompana y gestiona el espacio." },
  { value: "two_guardians", title: "Dos tutores", text: "Dos adultos coordinan el seguimiento." },
  { value: "separated_parents", title: "Padres separados", text: "Un tutor entra ahora y el otro puede quedar invitado." },
  { value: "legal_guardian", title: "Otro tutor legal", text: "Tutor, familiar o responsable legal." },
];

const STAGE_OPTIONS: Array<{ value: MentoriaLearningStage; label: string }> = [
  { value: "primary", label: "Primaria" },
  { value: "eso", label: "ESO" },
  { value: "bachillerato", label: "Bachillerato" },
];

const PRIORITY_OPTIONS: Array<{
  value: MentoriaInitialPriority;
  title: string;
  text: string;
  goal: OnboardingObjective;
  confidence: ConfidenceLabel;
  subjectSlugs: string[];
}> = [
  {
    value: "homework",
    title: "Deberes de hoy",
    text: "Entrar con una tarea concreta y resolver el atasco.",
    goal: "improve_understanding",
    confidence: "medium",
    subjectSlugs: ["matematicas", "lengua", "ingles"],
  },
  {
    value: "exam",
    title: "Examen cerca",
    text: "Ordenar que estudiar primero y practicar con foco.",
    goal: "pass_subject",
    confidence: "medium",
    subjectSlugs: ["matematicas", "fisica-y-quimica", "lengua"],
  },
  {
    value: "reinforcement",
    title: "Refuerzo",
    text: "Reforzar una materia que se esta haciendo cuesta arriba.",
    goal: "improve_understanding",
    confidence: "medium",
    subjectSlugs: ["matematicas", "lengua", "ciencias"],
  },
  {
    value: "organization",
    title: "Organizacion",
    text: "Convertir estudio, deberes y examenes en un plan viable.",
    goal: "build_habit",
    confidence: "medium",
    subjectSlugs: ["lengua", "matematicas", "ingles"],
  },
  {
    value: "frustration",
    title: "Bloqueo o frustracion",
    text: "Bajar carga, recuperar confianza y conseguir una primera victoria.",
    goal: "gain_confidence",
    confidence: "low",
    subjectSlugs: ["matematicas", "lengua", "ingles"],
  },
  {
    value: "other",
    title: "Otra necesidad",
    text: "Empezar con una ayuda guiada y ajustar despues.",
    goal: "improve_understanding",
    confidence: "medium",
    subjectSlugs: ["matematicas", "lengua", "ciencias"],
  },
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
    hasRepeatedCourse: null,
    subjects: [],
    initialPriority: "",
    confidenceLevel: "medium",
  },
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

function getSchoolYearOptions(stage: MentoriaLearningStage): string[] {
  if (stage === "primary") {
    return MENTORIA_SCHOOL_YEAR_OPTIONS.filter((year) => year.toLowerCase().includes("primaria"));
  }
  if (stage === "bachillerato") {
    return MENTORIA_SCHOOL_YEAR_OPTIONS.filter((year) => year.toLowerCase().includes("bach"));
  }
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

function inferSubjectsFromPriority(priority: MentoriaInitialPriority, subjects: MentoriaSubject[]): SubjectChoice[] {
  const priorityConfig = PRIORITY_OPTIONS.find((option) => option.value === priority) ?? PRIORITY_OPTIONS[2];
  const availableBySlug = new Map(subjects.map((subject) => [subject.slug, subject]));
  const matched = priorityConfig.subjectSlugs
    .filter((slug) => availableBySlug.has(slug))
    .slice(0, 1)
    .map((slug) => ({
      subjectSlug: slug,
      initialLevel: priority === "frustration" ? "me_cuesta_mucho" : "voy_normal",
    })) as SubjectChoice[];

  if (matched.length > 0) return matched;

  const fallback = subjects[0] ?? getFallbackSubjects(DEFAULT_STAGE)[0];
  return fallback ? [{ subjectSlug: fallback.slug, initialLevel: "me_cuesta_mucho" }] : [];
}

function buildMentoriaWorkspaceUrl(searchParams: SearchParamReader): string {
  const target = new URL("/mentoria/app", window.location.origin);
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

function getStepValidation(step: number, draft: OnboardingDraft): OnboardingValidation {
  if (step === 1) {
    if (!draft.primaryGuardian.fullName.trim()) {
      return { valid: false, message: "Escribe el nombre del tutor principal." };
    }
    if (!draft.primaryGuardian.relation) {
      return { valid: false, message: "Indica que relacion tiene el tutor principal." };
    }
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
    if (!draft.student.fullName.trim()) {
      return { valid: false, message: "Escribe el nombre del alumno." };
    }
    return { valid: true, message: null };
  }

  if (step === 2) {
    if (!draft.student.schoolYear.trim()) {
      return { valid: false, message: "Selecciona el curso real del alumno." };
    }
    if (draft.student.hasRepeatedCourse === null) {
      return { valid: false, message: "Indica si ha repetido curso." };
    }
    if (draft.student.subjects.length === 0) {
      return { valid: false, message: "Selecciona la materia o foco principal." };
    }
    return { valid: true, message: null };
  }

  if (step === 3) {
    if (!draft.student.initialPriority) {
      return { valid: false, message: "Selecciona con que arrancamos." };
    }
    return { valid: true, message: null };
  }

  return { valid: true, message: null };
}

function buildOnboardingPayload(
  draft: OnboardingDraft,
  subjects: MentoriaSubject[],
  searchParams: SearchParamReader,
): MentoriaOnboardingPayload {
  const selectedPriority = PRIORITY_OPTIONS.find((option) => option.value === draft.student.initialPriority) ?? PRIORITY_OPTIONS[2];
  const selectedSubjects = draft.student.subjects.length > 0
    ? draft.student.subjects
    : inferSubjectsFromPriority(selectedPriority.value, subjects);
  const secondaryGuardian = hasSecondaryGuardianDraft(draft)
    ? {
        fullName: draft.secondaryGuardian.fullName.trim(),
        relation: draft.secondaryGuardian.relation,
        ...(draft.secondaryGuardian.email.trim() ? { email: draft.secondaryGuardian.email.trim() } : {}),
      }
    : null;
  const referralCode = searchParams.get("ref") ?? undefined;
  const inviteToken = searchParams.get("invite") ?? undefined;

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
      hasRepeatedCourse: draft.student.hasRepeatedCourse ?? false,
    },
    subjects: selectedSubjects,
    goal: selectedPriority.goal,
    confidenceLevel: draft.student.confidenceLevel,
    initialPriority: selectedPriority.value,
    primaryConcern: selectedPriority.title,
    referralCode,
    inviteToken,
  };
}

function parseRepeatedCourse(supportNotes?: string): boolean | null {
  if (!supportNotes) return null;
  if (supportNotes.includes("repeticion si")) return true;
  if (supportNotes.includes("repeticion no")) return false;
  return null;
}

function parseInitialPriority(supportNotes?: string): PriorityDraftValue {
  if (!supportNotes) return "";
  if (supportNotes.includes("prioridad inicial deberes")) return "homework";
  if (supportNotes.includes("prioridad inicial examen")) return "exam";
  if (supportNotes.includes("prioridad inicial refuerzo")) return "reinforcement";
  if (supportNotes.includes("prioridad inicial organizacion")) return "organization";
  if (supportNotes.includes("prioridad inicial bloqueo/frustracion")) return "frustration";
  if (supportNotes.includes("prioridad inicial otra necesidad")) return "other";
  return "";
}

function StepBadge({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Paso ${current} de ${TOTAL_STEPS}`}>
      {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map((step) => (
        <div
          key={step}
          className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
            step <= current ? "bg-emerald-600" : "bg-slate-200"
          }`}
        />
      ))}
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  title,
  text,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  text?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[72px] rounded-lg border px-4 py-3 text-left text-sm transition-colors duration-200 ${
        selected
          ? "border-emerald-600 bg-emerald-50 text-emerald-950"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
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
  const [activationReady, setActivationReady] = useState(false);

  const schoolYearOptions = useMemo(() => getSchoolYearOptions(draft.student.stage), [draft.student.stage]);
  const subjectOptions = useMemo(
    () => (subjects.length > 0 ? subjects : getFallbackSubjects(draft.student.stage)),
    [draft.student.stage, subjects],
  );
  const selectedPriority = useMemo(
    () => PRIORITY_OPTIONS.find((option) => option.value === draft.student.initialPriority) ?? null,
    [draft.student.initialPriority],
  );

  useEffect(() => {
    const local = window.localStorage.getItem(STORAGE_KEY);
    if (local) {
      try {
        const parsed = JSON.parse(local) as Partial<OnboardingDraft> & {
          guardianName?: string;
          fullName?: string;
          schoolYear?: string;
          subjects?: SubjectChoice[];
          confidenceLevel?: ConfidenceLabel;
        };
        if (parsed && typeof parsed === "object" && !parsed.student) {
          setDraft((current) => ({
            ...current,
            primaryGuardian: {
              fullName: parsed.guardianName ?? current.primaryGuardian.fullName,
              relation: relationParam ?? current.primaryGuardian.relation,
            },
            student: {
              ...current.student,
              fullName: parsed.fullName ?? current.student.fullName,
              stage: deriveStageFromSchoolYear(parsed.schoolYear ?? current.student.schoolYear),
              schoolYear: parsed.schoolYear ?? current.student.schoolYear,
              subjects: Array.isArray(parsed.subjects) ? parsed.subjects : current.student.subjects,
              confidenceLevel: parsed.confidenceLevel ?? current.student.confidenceLevel,
            },
          }));
        } else if (parsed && parsed.student) {
          const parsedStudent = parsed.student;
          setDraft((current) => ({
            ...current,
            ...parsed,
            familyStructure: parsed.familyStructure ?? current.familyStructure,
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
              ...parsedStudent,
              stage: parsedStudent.stage ?? deriveStageFromSchoolYear(parsedStudent.schoolYear ?? current.student.schoolYear),
              schoolYear: parsedStudent.schoolYear ?? current.student.schoolYear,
              hasRepeatedCourse: parsedStudent.hasRepeatedCourse ?? current.student.hasRepeatedCourse,
              subjects: Array.isArray(parsedStudent.subjects) ? parsedStudent.subjects : current.student.subjects,
              initialPriority: parsedStudent.initialPriority ?? current.student.initialPriority,
              confidenceLevel: parsedStudent.confidenceLevel ?? current.student.confidenceLevel,
            },
          }));
        }
      } catch {
        // Ignore invalid local storage snapshots and continue with a fresh draft.
      }
    }

    void (async () => {
      try {
        const response = await fetch("/api/mentoria/onboarding", { cache: "no-store" });
        if (!response || typeof response.json !== "function") {
          return;
        }
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
        } else if (relationParam) {
          setDraft((current) => ({
            ...current,
            primaryGuardian: {
              ...current.primaryGuardian,
              relation: relationParam,
            },
          }));
        }

        const secondaryGuardian = (body.secondaryGuardians?.[0] ?? null) as MentoriaGuardian | null;
        if (secondaryGuardian) {
          setDraft((current) => ({
            ...current,
            familyStructure: "two_guardians",
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
              stage: deriveStageFromSchoolYear(currentStudent.schoolYear),
              schoolYear: currentStudent.schoolYear,
              hasRepeatedCourse: parseRepeatedCourse(currentStudent.supportNotes),
              subjects: studentSubjects
                .map((item) => ({ subjectSlug: item.subject?.slug ?? "", initialLevel: item.initialLevel }))
                .filter((item) => item.subjectSlug),
              initialPriority: parseInitialPriority(currentStudent.supportNotes),
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
    const blockingStep = [1, 2, 3]
      .map((candidateStep) => getStepValidation(candidateStep, draft))
      .find((validation) => !validation.valid);

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
      setActivationReady(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No hemos podido preparar el espacio.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-8 text-sm text-slate-600">Preparando Mentoria...</div>;
  }

  if (activationReady) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
        <main className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Mentoria familiar</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">Tu espacio ya esta preparado.</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Primera ayuda guiada lista con tutor, alumno, curso y prioridad inicial.</p>
          <button
            type="button"
            onClick={() => {
              window.location.href = buildMentoriaWorkspaceUrl(searchParams);
            }}
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            Entrar a Mentoria
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </main>
      </div>
    );
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
          {error ? (
            <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Quienes sois</h2>
                <p className="mt-1 text-sm text-slate-600">Tutor, estructura familiar y alumno. Solo lo necesario para abrir bien el espacio.</p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Tutor principal</label>
                  <input
                    value={draft.primaryGuardian.fullName}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setDraft((current) => ({
                        ...current,
                        primaryGuardian: { ...current.primaryGuardian, fullName: event.target.value },
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Nombre del tutor principal"
                  />
                  {sessionEmail ? <p className="mt-2 text-xs text-slate-500">{`Acceso: ${sessionEmail}`}</p> : null}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Relacion</label>
                  <div className="grid grid-cols-3 gap-2">
                    {RELATION_OPTIONS.map((option) => (
                      <ChoiceButton
                        key={option.value}
                        title={option.label}
                        selected={draft.primaryGuardian.relation === option.value}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            primaryGuardian: { ...current.primaryGuardian, relation: option.value },
                          }))
                        }
                      />
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
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          familyStructure: option.value,
                          primaryGuardian: {
                            ...current.primaryGuardian,
                            relation: option.value === "legal_guardian" ? "tutor" : current.primaryGuardian.relation,
                          },
                        }))
                      }
                    />
                  ))}
                </div>
              </div>

              {draft.familyStructure === "two_guardians" || draft.familyStructure === "separated_parents" ? (
                <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_1fr]">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                      {draft.familyStructure === "two_guardians" ? "Segundo tutor" : "Segundo tutor opcional"}
                    </label>
                    <input
                      value={draft.secondaryGuardian.fullName}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setDraft((current) => ({
                          ...current,
                          secondaryGuardian: { ...current.secondaryGuardian, fullName: event.target.value },
                        }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder="Nombre del segundo tutor"
                    />
                    <input
                      value={draft.secondaryGuardian.email}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setDraft((current) => ({
                          ...current,
                          secondaryGuardian: { ...current.secondaryGuardian, email: event.target.value },
                        }))
                      }
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      placeholder={draft.familyStructure === "two_guardians" ? "Email del segundo tutor" : "Email del segundo tutor (opcional)"}
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Relacion</label>
                    <div className="grid grid-cols-3 gap-2">
                      {RELATION_OPTIONS.map((option) => (
                        <ChoiceButton
                          key={option.value}
                          title={option.label}
                          selected={draft.secondaryGuardian.relation === option.value}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              secondaryGuardian: { ...current.secondaryGuardian, relation: option.value },
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Alumno</label>
                <input
                  value={draft.student.fullName}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setDraft((current) => ({
                      ...current,
                      student: { ...current.student, fullName: event.target.value },
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Nombre del alumno/a"
                />
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Donde esta hoy</h2>
                <p className="mt-1 text-sm text-slate-600">Etapa, curso real, repeticion y foco principal. La edad sale del curso, no al reves.</p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Etapa</label>
                <div className="grid gap-2 sm:grid-cols-3">
                  {STAGE_OPTIONS.map((option) => (
                    <ChoiceButton
                      key={option.value}
                      title={option.label}
                      selected={draft.student.stage === option.value}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          student: {
                            ...current.student,
                            stage: option.value,
                            schoolYear: getSchoolYearOptions(option.value).includes(current.student.schoolYear)
                              ? current.student.schoolYear
                              : "",
                          },
                        }))
                      }
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Curso real</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {schoolYearOptions.map((year) => (
                    <ChoiceButton
                      key={year}
                      title={year}
                      selected={draft.student.schoolYear === year}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          student: { ...current.student, schoolYear: year },
                        }))
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Repeticion de curso</label>
                  <div className="grid grid-cols-2 gap-2">
                    <ChoiceButton
                      title="No ha repetido"
                      selected={draft.student.hasRepeatedCourse === false}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          student: { ...current.student, hasRepeatedCourse: false },
                        }))
                      }
                    />
                    <ChoiceButton
                      title="Si, ha repetido"
                      selected={draft.student.hasRepeatedCourse === true}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          student: { ...current.student, hasRepeatedCourse: true },
                        }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Materia o foco principal</label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {subjectOptions.map((subject) => {
                      const selected = draft.student.subjects.some((item) => item.subjectSlug === subject.slug);
                      return (
                        <ChoiceButton
                          key={subject.slug}
                          title={subject.name}
                          selected={selected}
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              student: {
                                ...current.student,
                                subjects: [{ subjectSlug: subject.slug, initialLevel: "me_cuesta_mucho" }],
                              },
                            }))
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Con que arrancamos</h2>
                <p className="mt-1 text-sm text-slate-600">Elegimos la primera ayuda para que el espacio no nazca vacio.</p>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Prioridad inicial</label>
                <div className="grid gap-3 md:grid-cols-2">
                  {PRIORITY_OPTIONS.map((option) => (
                    <ChoiceButton
                      key={option.value}
                      title={option.title}
                      text={option.text}
                      selected={draft.student.initialPriority === option.value}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          student: {
                            ...current.student,
                            initialPriority: option.value,
                            confidenceLevel: option.confidence,
                          },
                        }))
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Como llega hoy</label>
                  <div className="grid gap-2">
                    {[
                      { value: "low" as const, label: "Bloqueado" },
                      { value: "medium" as const, label: "Normal" },
                      { value: "high" as const, label: "Con ganas" },
                    ].map((option) => (
                      <ChoiceButton
                        key={option.value}
                        title={option.label}
                        selected={draft.student.confidenceLevel === option.value}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            student: { ...current.student, confidenceLevel: option.value },
                          }))
                        }
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                  <div className="font-bold">Primer arranque</div>
                  <p className="mt-2">
                    {selectedPriority
                      ? `Mentoria preparara una ayuda de ${selectedPriority.title.toLowerCase()} para ${draft.student.fullName || "el alumno"}.`
                      : "Selecciona una prioridad y dejamos el primer espacio guiado listo."}
                  </p>
                  <p className="mt-2 text-emerald-800">
                    {draft.student.schoolYear || "Curso pendiente"} · {draft.student.subjects[0]?.subjectSlug ?? "materia pendiente"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setStep((current) => Math.max(1, current - 1));
                }}
                className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                disabled={saving}
              >
                Volver
              </button>
            ) : <span />}

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={() => {
                  const validation = getStepValidation(step, draft);
                  if (validation.valid) {
                    setError(null);
                    setStep((current) => Math.min(TOTAL_STEPS, current + 1));
                  } else {
                    setError(validation.message ?? "Completa este paso para seguir.");
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                Continuar
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={finish}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Preparando
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
