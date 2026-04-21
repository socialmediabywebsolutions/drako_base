"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { useSearchParams } from "next/navigation";
import { getLearningProfile } from "@/lib/mentoria/learning-profile";
import {
  getMicrocopy,
  getOnboardingUiCopy,
  MENTORIA_SCHOOL_YEAR_OPTIONS,
  getWorkspaceUiCopy,
} from "@/lib/mentoria/microcopy";
import type {
  MentoriaGuardianRole,
  MentoriaOnboardingPayload,
  MentoriaOnboardingPrimaryGuardian,
  MentoriaOnboardingState,
  MentoriaSubject,
} from "@/lib/mentoria/types";

type OnboardingObjective = MentoriaOnboardingPayload["goal"];
type ConfidenceLabel = "low" | "medium" | "high";
type LearningStage = "primary" | "eso" | "bachillerato";
type PrimaryConcernKey = "focus" | "math" | "reading" | "frustration" | "organization";

type SubjectChoice = {
  subjectSlug: string;
  initialLevel: "me_cuesta_mucho" | "voy_normal" | "se_me_da_bien";
};

type OnboardingDraft = {
  primaryGuardian: MentoriaOnboardingPrimaryGuardian;
  student: {
    fullName: string;
    stage: LearningStage;
    schoolYear: string;
    approximateAge: string;
    schoolName: string;
    subjects: SubjectChoice[];
    goal: OnboardingObjective;
    confidence: number;
    primaryConcern: PrimaryConcernKey;
  };
};

type OnboardingValidation = {
  valid: boolean;
  message: string | null;
};

type OnboardingSubmissionPayload = MentoriaOnboardingPayload;

type SearchParamReader = {
  get(name: string): string | null;
};

const STORAGE_KEY = "mentoria-onboarding-activation-v2";
const TOTAL_STEPS = 5;
const DEFAULT_STAGE = "eso";
const DEFAULT_SCHOOL_YEAR = MENTORIA_SCHOOL_YEAR_OPTIONS[6];
const DEFAULT_FALLBACK_SUBJECTS = getWorkspaceUiCopy(DEFAULT_STAGE).fallbackSubjects;
const GUARDIAN_STEP_COPY = {
  title: "Quien esta acompanando a tu hijo/a?",
  description: "Este acceso es del tutor principal. El pago y la configuracion de familia iran ligados a este perfil, no al alumno.",
};
const STUDENT_STEP_COPY = {
  title: "Cuentanos sobre tu hijo/a",
  description:
    "Solo pedimos lo esencial para empezar con algo util sobre lo que ya trae del colegio: deberes, examenes, notas, organizacion o bloqueo.",
};
const GOAL_STEP_COPY = {
  title: "Que te gustaria que cambiara primero?",
  confidenceTitle: "Como esta viviendo esto ahora mismo?",
  description: "Con esto elegimos la primera ayuda, la materia mas probable y el tono con el que arrancamos.",
};
const PRIMARY_GUARDIAN_OPTIONS: Array<{ value: MentoriaGuardianRole; label: string }> = [
  { value: "mother", label: "Madre" },
  { value: "father", label: "Padre" },
  { value: "tutor", label: "Tutor" },
];
const STAGE_OPTIONS: Array<{ value: LearningStage; label: string }> = [
  { value: "primary", label: "Primaria" },
  { value: "eso", label: "ESO" },
  { value: "bachillerato", label: "Bachillerato" },
];
const APPROXIMATE_AGE_OPTIONS = ["8-9", "10-11", "12-13", "14-15", "16-17"];
const PRIMARY_CONCERN_OPTIONS: Array<{
  value: PrimaryConcernKey;
  title: string;
  text: string;
  goal: OnboardingObjective;
  confidence: ConfidenceLabel;
  subjectSlugs: string[];
}> = [
  {
    value: "focus",
    title: "Le cuesta concentrarse",
    text: "Le cuesta sentarse, empezar o sostener la atencion con deberes y estudio.",
    goal: "build_habit",
    confidence: "low",
    subjectSlugs: ["lengua", "ciencias", "historia"],
  },
  {
    value: "math",
    title: "Va mal en mates",
    text: "Queremos reforzar una materia concreta que le esta frenando ahora mismo.",
    goal: "pass_subject",
    confidence: "medium",
    subjectSlugs: ["matematicas", "fisica-y-quimica", "economia"],
  },
  {
    value: "reading",
    title: "No entiende lo que lee",
    text: "Le cuesta comprender enunciados, textos o resumir lo importante.",
    goal: "improve_understanding",
    confidence: "medium",
    subjectSlugs: ["lengua", "historia", "biologia"],
  },
  {
    value: "frustration",
    title: "Se frustra con los deberes",
    text: "Necesita apoyo para desbloquearse y volver a sentir que puede avanzar.",
    goal: "gain_confidence",
    confidence: "low",
    subjectSlugs: ["matematicas", "lengua", "ingles"],
  },
  {
    value: "organization",
    title: "Queremos organizar mejor su estudio",
    text: "Necesitamos mas orden para deberes, examenes y continuidad semanal.",
    goal: "build_habit",
    confidence: "medium",
    subjectSlugs: ["lengua", "matematicas", "ingles"],
  },
];

function deriveStageFromSchoolYear(schoolYear: string): LearningStage {
  const normalized = schoolYear.toLowerCase().trim();
  if (normalized.includes("primaria")) return "primary";
  if (normalized.includes("bach")) return "bachillerato";
  return "eso";
}

function getSchoolYearOptions(stage: LearningStage): string[] {
  if (stage === "primary") {
    return MENTORIA_SCHOOL_YEAR_OPTIONS.filter((year) => year.toLowerCase().includes("primaria"));
  }
  if (stage === "bachillerato") {
    return MENTORIA_SCHOOL_YEAR_OPTIONS.filter((year) => year.toLowerCase().includes("bach"));
  }
  return MENTORIA_SCHOOL_YEAR_OPTIONS.filter((year) => year.toLowerCase().includes("eso"));
}

function inferSubjectsFromConcern(
  concern: PrimaryConcernKey,
  subjects: MentoriaSubject[],
): SubjectChoice[] {
  const concernConfig = PRIMARY_CONCERN_OPTIONS.find((option) => option.value === concern) ?? PRIMARY_CONCERN_OPTIONS[0];
  const availableBySlug = new Map(subjects.map((subject) => [subject.slug, subject]));
  const matched = concernConfig.subjectSlugs
    .filter((slug) => availableBySlug.has(slug))
    .slice(0, 2)
    .map((slug, index) => ({
      subjectSlug: slug,
      initialLevel: index === 0 ? "me_cuesta_mucho" : "voy_normal",
    })) as SubjectChoice[];

  if (matched.length > 0) {
    return matched;
  }

  return DEFAULT_FALLBACK_SUBJECTS.slice(0, 2).map((subject, index) => ({
    subjectSlug: subject.slug,
    initialLevel: index === 0 ? "me_cuesta_mucho" : "voy_normal",
  }));
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

const EMPTY_DRAFT: OnboardingDraft = {
  primaryGuardian: {
    fullName: "",
    relation: "tutor",
  },
  student: {
    fullName: "",
    stage: "eso",
    schoolYear: "",
    approximateAge: "12-13",
    schoolName: "",
    subjects: [],
    goal: "improve_understanding",
    confidence: 2,
    primaryConcern: "math",
  },
};

function confidenceLabelToNumber(label: ConfidenceLabel): number {
  if (label === "low") return 1;
  if (label === "high") return 3;
  return 2;
}

function confidenceNumberToLabel(value: number): ConfidenceLabel {
  if (value <= 1) return "low";
  if (value >= 3) return "high";
  return "medium";
}

function getStepValidation(step: number, draft: OnboardingDraft): OnboardingValidation {
  if (step === 1) {
    if (!draft.primaryGuardian.fullName.trim()) {
      return { valid: false, message: "Escribe el nombre del tutor principal." };
    }
    if (!draft.primaryGuardian.relation) {
      return { valid: false, message: "Selecciona si eres padre, madre o tutor." };
    }
    return { valid: true, message: null };
  }

  if (step === 2) {
    if (!draft.student.fullName.trim()) {
      return { valid: false, message: "Escribe el nombre del alumno." };
    }
    if (!draft.student.schoolYear.trim()) {
      return { valid: false, message: "Selecciona el curso del alumno." };
    }
    return { valid: true, message: null };
  }

  if (step === 3) {
    if (draft.student.subjects.length === 0) {
      return { valid: false, message: "Selecciona al menos una materia." };
    }
    return { valid: true, message: null };
  }

  if (step === 4) {
    if (!draft.student.goal) {
      return { valid: false, message: "Selecciona el objetivo principal." };
    }
    return typeof draft.student.confidence === "number" && draft.student.confidence >= 1
      ? { valid: true, message: null }
      : { valid: false, message: "Indica como se siente ahora mismo." };
  }

  return { valid: true, message: null };
}

function buildOnboardingPayload(
  draft: OnboardingDraft,
  searchParams: SearchParamReader,
): OnboardingSubmissionPayload {
  const payload: OnboardingSubmissionPayload = {
    primaryGuardian: {
      fullName: draft.primaryGuardian.fullName.trim(),
      relation: draft.primaryGuardian.relation,
    },
    student: {
      fullName: draft.student.fullName.trim(),
      schoolYear: draft.student.schoolYear,
    },
    subjects: draft.student.subjects,
    goal: draft.student.goal,
    confidenceLevel: confidenceNumberToLabel(draft.student.confidence),
  };
  const schoolName = draft.student.schoolName.trim();
  const referralCode = searchParams.get("ref") ?? undefined;
  const inviteToken = searchParams.get("invite") ?? undefined;
  if (schoolName) payload.student.schoolName = schoolName;
  if (referralCode) payload.referralCode = referralCode;
  if (inviteToken) payload.inviteToken = inviteToken;
  return payload;
}

function StepBadge({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center gap-2">
      {Array.from({ length: TOTAL_STEPS }, (_, index) => index + 1).map((step) => (
        <div
          key={step}
          className={`h-2 flex-1 rounded-full transition-colors duration-200 ${
            step <= current ? "bg-emerald-500 shadow-md" : "bg-slate-200 shadow-inner"
          }`}
        />
      ))}
    </div>
  );
}

function getAgeFromSchoolYear(schoolYear: string): number {
  const year = schoolYear.toLowerCase().trim();
  if (year === "1 primaria") return 6;
  if (year === "2 primaria") return 7;
  if (year === "3 primaria") return 8;
  if (year === "4 primaria") return 9;
  if (year === "5 primaria") return 10;
  if (year === "6 primaria") return 11;
  if (year === "1 eso") return 12;
  if (year === "2 eso") return 13;
  if (year === "3 eso") return 14;
  if (year === "4 eso") return 15;
  return 16;
}

export function MentoriaOnboardingWizard() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [subjects, setSubjects] = useState<MentoriaSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activationReady, setActivationReady] = useState(false);

  const learningProfile = getLearningProfile({
    schoolYear: draft.student.schoolYear || DEFAULT_SCHOOL_YEAR,
    age: getAgeFromSchoolYear(draft.student.schoolYear || DEFAULT_SCHOOL_YEAR),
  });
  const ui = getOnboardingUiCopy(learningProfile.stage);
  const onboardingMessage = getMicrocopy(learningProfile.stage, "onboarding_message");
  const relationParam = searchParams.get("relation") as MentoriaGuardianRole | null;
  const schoolYearOptions = useMemo(() => getSchoolYearOptions(draft.student.stage), [draft.student.stage]);
  const selectedConcern = useMemo(
    () => PRIMARY_CONCERN_OPTIONS.find((option) => option.value === draft.student.primaryConcern) ?? PRIMARY_CONCERN_OPTIONS[0],
    [draft.student.primaryConcern],
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
          objective?: OnboardingObjective;
          confidenceLevel?: ConfidenceLabel;
        };
        if (parsed && typeof parsed === "object" && !parsed.student) {
          const migrated: OnboardingDraft = {
            primaryGuardian: {
              fullName: parsed.guardianName ?? "",
              relation: relationParam ?? "tutor",
            },
            student: {
              fullName: parsed.fullName ?? "",
              stage: deriveStageFromSchoolYear(parsed.schoolYear ?? ""),
              schoolYear: parsed.schoolYear ?? "",
              approximateAge: "12-13",
              schoolName: "",
              subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
              goal: parsed.objective ?? "improve_understanding",
              confidence: confidenceLabelToNumber(parsed.confidenceLevel ?? "medium"),
              primaryConcern: "math",
            },
          };
          setDraft(migrated);
        } else if (parsed && parsed.student) {
          setDraft((current: OnboardingDraft) => ({
            ...current,
            ...(parsed as OnboardingDraft),
            primaryGuardian: {
              fullName: parsed.primaryGuardian?.fullName ?? current.primaryGuardian.fullName,
              relation: parsed.primaryGuardian?.relation ?? (relationParam ?? current.primaryGuardian.relation),
            },
            student: {
              ...current.student,
              ...(parsed as OnboardingDraft).student,
              stage: (parsed as OnboardingDraft).student?.stage ?? deriveStageFromSchoolYear((parsed as OnboardingDraft).student?.schoolYear ?? current.student.schoolYear),
              approximateAge: (parsed as OnboardingDraft).student?.approximateAge ?? current.student.approximateAge,
              schoolName: (parsed as OnboardingDraft).student?.schoolName ?? current.student.schoolName,
              primaryConcern: (parsed as OnboardingDraft).student?.primaryConcern ?? current.student.primaryConcern,
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
          setError(body?.error ?? ui.submitError);
          return;
        }

        setSubjects(
          body.subjects && body.subjects.length > 0
            ? body.subjects
            : DEFAULT_FALLBACK_SUBJECTS.map(
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
              ),
        );

        if (body.primaryGuardian) {
          setDraft((current: OnboardingDraft) => ({
            ...current,
            primaryGuardian: {
              fullName: current.primaryGuardian.fullName || body.primaryGuardian?.fullName || "",
              relation: body.primaryGuardian?.relation ?? (relationParam ?? current.primaryGuardian.relation),
            },
          }));
        } else {
          if (relationParam) {
            setDraft((current: OnboardingDraft) => ({
              ...current,
              primaryGuardian: {
                ...current.primaryGuardian,
                relation: relationParam,
              },
            }));
          }
        }

        const currentStudent = body.student ?? body.profile ?? null;

        if (currentStudent?.onboardingCompleted) {
          window.location.href = buildMentoriaWorkspaceUrl(searchParams);
          return;
        }

        if (currentStudent) {
          const profile = currentStudent;
          const studentSubjects = body.studentSubjects ?? [];
          const inferredObjective =
            profile.supportNotes?.includes("pass_subject")
              ? "pass_subject"
              : profile.supportNotes?.includes("build_habit")
                ? "build_habit"
                : profile.supportNotes?.includes("gain_confidence")
                  ? "gain_confidence"
                  : "improve_understanding";
          const inferredConfidenceLabel: ConfidenceLabel = profile.supportNotes?.includes("confianza low")
            ? "low"
            : profile.supportNotes?.includes("confianza high")
              ? "high"
              : "medium";

          setDraft((current: OnboardingDraft) => ({
            primaryGuardian: {
              fullName: current.primaryGuardian.fullName || body.primaryGuardian?.fullName || "",
              relation: body.primaryGuardian?.relation ?? current.primaryGuardian.relation,
            },
            student: {
              fullName: profile.fullName,
              stage: deriveStageFromSchoolYear(profile.schoolYear),
              schoolYear: profile.schoolYear,
              approximateAge: `${Math.max(profile.age - 1, 6)}-${profile.age}`,
              schoolName: profile.supportNotes?.match(/centro ([^|]+)/)?.[1]?.trim() ?? "",
              goal: inferredObjective,
              confidence: confidenceLabelToNumber(inferredConfidenceLabel),
              subjects: studentSubjects
                .map((item) => ({ subjectSlug: item.subject?.slug ?? "", initialLevel: item.initialLevel }))
                .filter((item) => item.subjectSlug),
              primaryConcern: profile.supportNotes?.includes("preocupacion Le cuesta concentrarse")
                ? "focus"
                : profile.supportNotes?.includes("preocupacion No entiende lo que lee")
                  ? "reading"
                  : profile.supportNotes?.includes("preocupacion Se frustra con los deberes")
                    ? "frustration"
                    : profile.supportNotes?.includes("preocupacion Queremos organizar mejor su estudio")
                      ? "organization"
                      : "math",
            },
          }));
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : ui.submitError);
      } finally {
        setLoading(false);
      }
    })();
  }, [relationParam]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  async function finish() {
    const inferredSubjects = draft.student.subjects.length > 0 ? draft.student.subjects : inferSubjectsFromConcern(draft.student.primaryConcern, subjects);
    const draftToSubmit: OnboardingDraft = {
      ...draft,
      student: {
        ...draft.student,
        subjects: inferredSubjects,
      },
    };

    const blockingStep = [1, 2, 3, 4]
      .map((candidateStep) => getStepValidation(candidateStep, draft))
      .find((validation) => !validation.valid);

    if (blockingStep) {
      setError(blockingStep.message ?? ui.validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/mentoria/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildOnboardingPayload(draftToSubmit, searchParams)),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        activation?: Record<string, unknown>;
      } | null;

      if (!response.ok) {
        setError(body?.error ?? ui.submitError);
        return;
      }

      window.localStorage.removeItem(STORAGE_KEY);
      setActivationReady(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : ui.submitError);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-[#f5f2eb] p-8">{ui.loading}</div>;
  }

  if (activationReady) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff7ed,0,#f8fafc_55%,#eef6ff_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-[36px] bg-white/90 p-8 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-shadow duration-200">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">Mentoria familiar</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Tu espacio ya esta preparado.</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Primera ayuda guiada lista para empezar con contexto.</p>
          <button
            type="button"
            onClick={() => {
              window.location.href = buildMentoriaWorkspaceUrl(searchParams);
            }}
            className="mt-8 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            Entrar a Mentoria
          </button>
        </div>
      </div>
    );
  }

  if (step === 0) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff7ed,0,#f8fafc_55%,#eef6ff_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-[36px] bg-white/90 p-8 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-shadow duration-200">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">Mentoria familiar</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">Vamos a ayudar a tu hijo de verdad</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">{onboardingMessage}</p>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="mt-8 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            Empezar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff7ed,0,#f8fafc_55%,#eef6ff_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[36px] bg-white/90 p-8 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-shadow duration-200">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">Mentoria familiar</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Alta corta para empezar con valor real</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">{`${onboardingMessage} Lo justo para entender quien acompana, a que alumno ayudamos y cual es la primera prioridad que ya trae del colegio.`}</p>

        <div className="mt-8">
          <StepBadge current={step} />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{`Paso ${step} de ${TOTAL_STEPS}`}</p>
        </div>

        {error ? (
          <div role="alert" className="mb-4 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm ring-1 ring-red-100">{error}</div>
        ) : null}

        {step === 1 ? (
          <section className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold">{GUARDIAN_STEP_COPY.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{GUARDIAN_STEP_COPY.description}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Nombre</label>
                <input
                  value={draft.primaryGuardian.fullName}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setDraft((current: OnboardingDraft) => ({
                      ...current,
                      primaryGuardian: {
                        ...current.primaryGuardian,
                        fullName: event.target.value,
                      },
                    }))
                  }
                  className="w-full rounded-3xl border border-slate-200 bg-white px-5 py-4 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Nombre completo del tutor principal"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Email</label>
                <input
                  value={searchParams.get("email") ?? ""}
                  readOnly
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-slate-500 focus:outline-none"
                  placeholder="El email viene del alta"
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {PRIMARY_GUARDIAN_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setDraft((current: OnboardingDraft) => ({
                      ...current,
                      primaryGuardian: {
                        ...current.primaryGuardian,
                        relation: option.value,
                      },
                    }))
                  }
                  className={`rounded-3xl border px-4 py-4 text-left text-sm transition-colors transition-shadow duration-200 ${
                    draft.primaryGuardian.relation === option.value
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="rounded-3xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-900">
              El tutor principal es quien entra primero, gestiona la familia y ve despues el pago si hace falta. El alumno no paga.
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">{STUDENT_STEP_COPY.title}</h2>
            <p className="text-sm text-slate-600">{STUDENT_STEP_COPY.description}</p>
            <input
              value={draft.student.fullName}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setDraft((current: OnboardingDraft) => ({
                  ...current,
                  student: { ...current.student, fullName: event.target.value },
                }))
              }
              className="w-full rounded-3xl border border-slate-200 bg-white px-5 py-4 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Nombre del alumno/a"
            />
            <div className="grid gap-3 md:grid-cols-3">
              {STAGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setDraft((current: OnboardingDraft) => ({
                      ...current,
                      student: {
                        ...current.student,
                        stage: option.value,
                        schoolYear: getSchoolYearOptions(option.value)[0] ?? current.student.schoolYear,
                      },
                    }))
                  }
                  className={`rounded-3xl border px-4 py-4 text-left text-sm transition-colors duration-200 ${
                    draft.student.stage === option.value
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md hover:shadow-lg"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {schoolYearOptions.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() =>
                    setDraft((current: OnboardingDraft) => ({
                      ...current,
                      student: { ...current.student, schoolYear: year },
                    }))
                  }
                  className={`rounded-3xl border px-4 py-4 text-left text-sm transition-colors duration-200 ${
                    draft.student.schoolYear === year
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Edad aproximada</label>
                <div className="grid grid-cols-2 gap-2">
                  {APPROXIMATE_AGE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() =>
                        setDraft((current: OnboardingDraft) => ({
                          ...current,
                          student: { ...current.student, approximateAge: option },
                        }))
                      }
                      className={`rounded-2xl border px-4 py-3 text-sm ${draft.student.approximateAge === option ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700"}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Centro</label>
                <input
                  value={draft.student.schoolName}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setDraft((current: OnboardingDraft) => ({
                      ...current,
                      student: { ...current.student, schoolName: event.target.value },
                    }))
                  }
                  className="w-full rounded-3xl border border-slate-200 bg-white px-5 py-4 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Centro opcional"
                />
              </div>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-5">
            <h2 className="text-2xl font-bold">Donde necesita mas ayuda?</h2>
            <p className="text-sm text-slate-600">Elige la materia principal para preparar la primera ayuda.</p>
            <div className="grid gap-3 md:grid-cols-2">
              {(subjects.length > 0 ? subjects : DEFAULT_FALLBACK_SUBJECTS.map((subject) => ({
                id: subject.slug,
                tenantId: "",
                slug: subject.slug,
                name: subject.label,
                description: "",
                difficultyBand: "core",
                createdAt: "",
                updatedAt: "",
              } as MentoriaSubject))).map((subject) => {
                const checked = draft.student.subjects.some((item) => item.subjectSlug === subject.slug);
                return (
                  <label
                    key={subject.slug}
                    className={`flex items-center gap-3 rounded-3xl border p-5 text-left transition-colors ${
                      checked ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md" : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event: ChangeEvent<HTMLInputElement>) =>
                        setDraft((current: OnboardingDraft) => ({
                          ...current,
                          student: {
                            ...current.student,
                            subjects: event.target.checked
                              ? [{ subjectSlug: subject.slug, initialLevel: "me_cuesta_mucho" }]
                              : current.student.subjects.filter((item) => item.subjectSlug !== subject.slug),
                          },
                        }))
                      }
                      className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="font-semibold">{subject.name}</span>
                  </label>
                );
              })}
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="space-y-5">
            <h2 className="text-2xl font-bold">{GOAL_STEP_COPY.title}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {PRIMARY_CONCERN_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setDraft((current: OnboardingDraft) => ({
                      ...current,
                      student: {
                        ...current.student,
                        primaryConcern: option.value,
                        goal: option.goal,
                        confidence: confidenceLabelToNumber(option.confidence),
                      },
                    }))
                  }
                  className={`rounded-3xl border p-5 text-left transition-colors transition-shadow duration-200 ${
                    draft.student.primaryConcern === option.value
                      ? "border-sky-500 bg-sky-50 shadow-md hover:shadow-lg"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                  }`}
                >
                  <div className="font-semibold">{option.title}</div>
                  <div className="mt-2 text-sm text-slate-600">{option.text}</div>
                </button>
              ))}
            </div>
            <div className="pt-2">
              <h3 className="text-lg font-bold">{GOAL_STEP_COPY.confidenceTitle}</h3>
              <p className="mt-2 text-sm text-slate-600">{GOAL_STEP_COPY.description}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div className="font-semibold">Lectura inicial</div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {Object.entries(ui.step3.confidenceOptions).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setDraft((current: OnboardingDraft) => ({
                        ...current,
                        student: { ...current.student, confidence: confidenceLabelToNumber(value as ConfidenceLabel) },
                      }))
                    }
                    className={`rounded-2xl border px-4 py-3 text-sm ${confidenceNumberToLabel(draft.student.confidence) === value ? "border-sky-500 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-700"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-2xl bg-white px-4 py-4 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">Lo que vera el tutor al entrar</div>
                <div className="mt-2">Alumno asociado, trabajo pendiente, materias con mas dificultad, progreso, senales de bloqueo y una siguiente accion concreta para acompanar hoy.</div>
                <div className="mt-3 text-slate-600">Primera ayuda prevista: {selectedConcern.title}.</div>
              </div>
            </div>
          </section>
        ) : null}

        {step === 5 ? (
          <section className="space-y-5">
            <h2 className="text-2xl font-bold">Todo listo</h2>
            <p className="text-sm text-slate-600">Ya tenemos el tutor principal, el alumno, la materia y la primera prioridad.</p>
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
              Mentoria preparara el primer espacio guiado con {draft.student.subjects[0]?.subjectSlug ?? "la materia elegida"}.
            </div>
          </section>
        ) : null}

        <div className={`mt-8 flex items-center ${step === TOTAL_STEPS ? "justify-end" : "justify-between"}`}>
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((current: number) => Math.max(1, current - 1))}
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              disabled={saving}
            >
              {ui.back}
            </button>
          ) : null}
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={() => {
                const validation = getStepValidation(step, draft);
                if (validation.valid) {
                  setError(null);
                  setStep((current: number) => Math.min(TOTAL_STEPS, current + 1));
                } else {
                  setError(validation.message ?? ui.validationError);
                }
              }}
              className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ui.next}
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={finish}
              className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? ui.saving : "Preparar espacio"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
