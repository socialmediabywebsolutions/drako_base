"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { useSearchParams } from "next/navigation";
import { getLearningProfile } from "@/lib/mentoria/learning-profile";
import {
  getMicrocopy,
  getOnboardingUiCopy,
  MENTORIA_SCHOOL_YEAR_OPTIONS,
  getWorkspaceUiCopy,
} from "@/lib/mentoria/microcopy";
import type {
  DailyPlan,
  MentoriaGuardianRole,
  MentoriaOnboardingPayload,
  MentoriaOnboardingPrimaryGuardian,
  MentoriaProgress,
  MentoriaStudentSubject,
  MentoriaSubject,
  StudentProfile,
} from "@/lib/mentoria/types";

type OnboardingObjective = MentoriaOnboardingPayload["goal"];
type ConfidenceLabel = "low" | "medium" | "high";

type SubjectChoice = {
  subjectSlug: string;
  initialLevel: "me_cuesta_mucho" | "voy_normal" | "se_me_da_bien";
};

type OnboardingDraft = {
  primaryGuardian: MentoriaOnboardingPrimaryGuardian;
  student: {
    fullName: string;
    schoolYear: string;
    subjects: SubjectChoice[];
    goal: OnboardingObjective;
    confidence: number;
  };
};

type ActivationState = {
  reply: string;
  subjectName: string;
  dailyPlan: DailyPlan;
  nextActions: string[];
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
const DEFAULT_STAGE = "eso";
const DEFAULT_SCHOOL_YEAR = MENTORIA_SCHOOL_YEAR_OPTIONS[6];
const DEFAULT_FALLBACK_SUBJECTS = getWorkspaceUiCopy(DEFAULT_STAGE).fallbackSubjects;
const GUARDIAN_STEP_COPY = {
  title: "1. Tutor principal",
  description: "Quien esta haciendo el alta y acompanara este primer arranque del alumno.",
};
const OBJECTIVE_STEP_COPY = {
  title: "4. Objetivo principal",
  description: "Con esto guiamos la ayuda inicial al resultado mas importante.",
};

function buildMentoriaWorkspaceUrl(searchParams: SearchParamReader): string {
  const target = new URL("/mentoria/app", window.location.origin);
  const localOverrideHost = searchParams.get("__drako_host")?.trim();
  const hostname = window.location.hostname.toLowerCase();
  if (localOverrideHost) {
    target.searchParams.set("__drako_host", localOverrideHost);
  } else if (hostname === "localhost" || hostname === "127.0.0.1") {
    target.searchParams.set("__drako_host", "mentoria.drako.systems");
  }
  return `${target.pathname}${target.search}`;
}

const EMPTY_DRAFT: OnboardingDraft = {
  primaryGuardian: {
    fullName: "",
    relation: "tutor",
  },
  student: {
    fullName: "",
    schoolYear: "",
    subjects: [],
    goal: "improve_understanding",
    confidence: 2,
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

function renumberStepTitle(title: string, step: number): string {
  return title.replace(/^\d+\.\s*/, `${step}. `);
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
    return draft.student.subjects.length > 0
      ? { valid: true, message: null }
      : { valid: false, message: "Selecciona al menos una materia." };
  }

  if (step === 4) {
    return draft.student.goal
      ? { valid: true, message: null }
      : { valid: false, message: "Selecciona el objetivo principal." };
  }

  if (step === 5) {
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
  return {
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
    referralCode: searchParams.get("ref") ?? undefined,
    inviteToken: searchParams.get("invite") ?? undefined,
  };
}

function formatGuardianRelationLabel(relation: MentoriaGuardianRole): string {
  if (relation === "father") return "Padre";
  if (relation === "mother") return "Madre";
  return "Tutor";
}

function StepBadge({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center gap-2">
      {[1, 2, 3, 4, 5, 6].map((step) => (
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
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<OnboardingDraft>(EMPTY_DRAFT);
  const [subjects, setSubjects] = useState<MentoriaSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activation, setActivation] = useState<ActivationState | null>(null);

  const learningProfile = getLearningProfile({
    schoolYear: draft.student.schoolYear || DEFAULT_SCHOOL_YEAR,
    age: getAgeFromSchoolYear(draft.student.schoolYear || DEFAULT_SCHOOL_YEAR),
  });
  const ui = getOnboardingUiCopy(learningProfile.stage);
  const workspaceUi = getWorkspaceUiCopy(learningProfile.stage);
  const onboardingMessage = getMicrocopy(learningProfile.stage, "onboarding_message");

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
              relation: "tutor",
            },
            student: {
              fullName: parsed.fullName ?? "",
              schoolYear: parsed.schoolYear ?? "",
              subjects: Array.isArray(parsed.subjects) ? parsed.subjects : [],
              goal: parsed.objective ?? "improve_understanding",
              confidence: confidenceLabelToNumber(parsed.confidenceLevel ?? "medium"),
            },
          };
          setDraft(migrated);
        } else if (parsed && parsed.student) {
          setDraft((current) => ({
            ...current,
            ...(parsed as OnboardingDraft),
            primaryGuardian: {
              fullName: parsed.primaryGuardian?.fullName ?? current.primaryGuardian.fullName,
              relation: parsed.primaryGuardian?.relation ?? current.primaryGuardian.relation,
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
        if (response.status === 401) {
          window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/onboarding";
          return;
        }

        const body = (await response.json()) as {
          ok?: boolean;
          error?: string;
          primaryGuardian?: MentoriaOnboardingPrimaryGuardian | null;
          profile?: StudentProfile | null;
          subjects?: MentoriaSubject[];
          studentSubjects?: MentoriaStudentSubject[];
        };

        if (!response.ok) {
          setError(body.error ?? ui.submitError);
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
          setDraft((current) => ({
            ...current,
            primaryGuardian: {
              fullName: current.primaryGuardian.fullName || body.primaryGuardian?.fullName || "",
              relation: body.primaryGuardian?.relation ?? current.primaryGuardian.relation,
            },
          }));
        }

        if (body.profile?.onboardingCompleted) {
          window.location.href = buildMentoriaWorkspaceUrl(searchParams);
          return;
        }

        if (body.profile) {
          const profile = body.profile;
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

          setDraft((current) => ({
            primaryGuardian: {
              fullName: current.primaryGuardian.fullName || body.primaryGuardian?.fullName || "",
              relation: body.primaryGuardian?.relation ?? current.primaryGuardian.relation,
            },
            student: {
              fullName: profile.fullName,
              schoolYear: profile.schoolYear,
              goal: inferredObjective,
              confidence: confidenceLabelToNumber(inferredConfidenceLabel),
              subjects: studentSubjects
                .map((item) => ({ subjectSlug: item.subject?.slug ?? "", initialLevel: item.initialLevel }))
                .filter((item) => item.subjectSlug),
            },
          }));
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : ui.submitError);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  const selectedSubjectSlugs = useMemo(
    () => new Set(draft.student.subjects.map((item) => item.subjectSlug)),
    [draft.student.subjects],
  );

  async function finish() {
    const blockingStep = [1, 2, 3, 4, 5]
      .map((candidateStep) => getStepValidation(candidateStep, draft))
      .find((validation) => !validation.valid);

    if (blockingStep) {
      setError(blockingStep.message ?? ui.validationError);
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch("/api/mentoria/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildOnboardingPayload(draft, searchParams)),
    });
    const body = (await response.json()) as {
      error?: string;
      activation?: ActivationState;
      progress?: MentoriaProgress[];
    };

    setSaving(false);
    if (!response.ok || !body.activation) {
      setError(body.error ?? ui.submitError);
      return;
    }

    setActivation(body.activation);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  if (loading) {
    return <div className="min-h-screen bg-[#f5f2eb] p-8">{ui.loading}</div>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#fff7ed,0,#f8fafc_55%,#eef6ff_100%)] px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-[36px] bg-white/90 p-8 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-shadow duration-200">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">{ui.badge}</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">{ui.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">{`${onboardingMessage} ${ui.description}`}</p>

        <div className="mt-8">
          <StepBadge current={step} />
        </div>

        {error ? (
          <div role="alert" className="mb-4 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm ring-1 ring-red-100">{error}</div>
        ) : null}

        {step === 1 ? (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">{GUARDIAN_STEP_COPY.title}</h2>
            <p className="text-sm text-slate-600">{GUARDIAN_STEP_COPY.description}</p>
            <input
              value={draft.primaryGuardian.fullName}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setDraft((current) => ({
                  ...current,
                  primaryGuardian: {
                    ...current.primaryGuardian,
                    fullName: event.target.value,
                  },
                }))
              }
              className="w-full rounded-3xl border border-slate-200 px-5 py-4 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors duration-200"
              placeholder="Tu nombre (padre, madre o tutor)"
            />
            <div className="grid gap-3 md:grid-cols-3">
              {([
                { value: "father", label: "Padre" },
                { value: "mother", label: "Madre" },
                { value: "tutor", label: "Tutor" },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      primaryGuardian: {
                        ...current.primaryGuardian,
                        relation: option.value,
                      },
                    }))
                  }
                  className={`rounded-3xl border px-4 py-4 text-left text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors transition-shadow transition-transform duration-200 ease-out active:scale-[0.99] ${
                    draft.primaryGuardian.relation === option.value
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md hover:shadow-lg"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {draft.primaryGuardian.fullName.trim() ? (
              <div className="rounded-3xl bg-emerald-50 p-4 text-sm text-emerald-900">{`Tranquilo, ${draft.primaryGuardian.fullName.trim()}, vamos paso a paso.`}</div>
            ) : null}
          </section>
        ) : null}

        {step === 2 ? (
          <section className="space-y-4">
            <h2 className="text-2xl font-bold">{renumberStepTitle(ui.step1.title, 2)}</h2>
            <p className="text-sm text-slate-600">{ui.step1.description}</p>
            <input
              value={draft.student.fullName}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setDraft((current) => ({
                  ...current,
                  student: { ...current.student, fullName: event.target.value },
                }))
              }
              className="w-full rounded-3xl border border-slate-200 px-5 py-4 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors duration-200"
              placeholder={ui.step1.fullNamePlaceholder}
            />
            <div className="grid gap-3 md:grid-cols-3">
              {MENTORIA_SCHOOL_YEAR_OPTIONS.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      student: { ...current.student, schoolYear: year },
                    }))
                  }
                  className={`rounded-3xl border px-4 py-4 text-left text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors transition-shadow transition-transform duration-200 ease-out active:scale-[0.99] ${
                    draft.student.schoolYear === year
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md hover:shadow-lg"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="space-y-5">
            <h2 className="text-2xl font-bold">{renumberStepTitle(ui.step2.title, 3)}</h2>
            <p className="text-sm text-slate-600">{ui.step2.description}</p>
            <div className="grid gap-4 md:grid-cols-2">
              {subjects.map((subject) => {
                const current = draft.student.subjects.find((item: SubjectChoice) => item.subjectSlug === subject.slug);
                const selected = selectedSubjectSlugs.has(subject.slug);
                const toggle = () =>
                  setDraft((currentDraft: OnboardingDraft) => ({
                    ...currentDraft,
                    student: {
                      ...currentDraft.student,
                      subjects: selected
                        ? currentDraft.student.subjects.filter((item: SubjectChoice) => item.subjectSlug !== subject.slug)
                        : currentDraft.student.subjects.some((item: SubjectChoice) => item.subjectSlug === subject.slug)
                          ? currentDraft.student.subjects
                          : [
                              ...currentDraft.student.subjects,
                              { subjectSlug: subject.slug, initialLevel: "me_cuesta_mucho" },
                            ],
                    },
                  }));
                return (
                  <div
                    key={subject.id}
                    role="checkbox"
                    aria-checked={selected}
                    tabIndex={0}
                    onClick={toggle}
                    onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                      if (e.currentTarget !== e.target) return;
                      if (e.key === " " || e.key === "Spacebar" || e.key === "Enter") {
                        e.preventDefault();
                        toggle();
                      }
                    }}
                    className={`rounded-3xl border p-4 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors transition-shadow transition-transform duration-200 ease-out active:scale-[0.99] ${
                      selected
                        ? "border-emerald-500 bg-emerald-50 shadow-md hover:shadow-lg"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold">{subject.name}</div>
                        <div className="text-sm text-slate-500">{subject.description}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={selected}
                        readOnly
                        tabIndex={-1}
                        aria-hidden="true"
                      />
                    </div>
                    {current ? (
                      <div className="mt-4 grid gap-2">
                        {Object.entries(ui.step2.levels).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                              e.stopPropagation();
                              setDraft((currentDraft: OnboardingDraft) => ({
                                ...currentDraft,
                                student: {
                                  ...currentDraft.student,
                                  subjects: currentDraft.student.subjects.map((item: SubjectChoice) =>
                                    item.subjectSlug === subject.slug
                                      ? { ...item, initialLevel: value as SubjectChoice["initialLevel"] }
                                      : item,
                                  ),
                                },
                              }));
                            }}
                            className={`rounded-2xl px-4 py-3 text-left text-sm transition-transform duration-150 ease-out active:scale-[0.99] ${
                              current.initialLevel === value ? "bg-emerald-100 text-emerald-900" : "bg-slate-50 text-slate-700"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="space-y-5">
            <h2 className="text-2xl font-bold">{OBJECTIVE_STEP_COPY.title}</h2>
            <p className="text-sm text-slate-600">{OBJECTIVE_STEP_COPY.description}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(ui.step2.objectives).map(([value, option]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      student: { ...current.student, goal: value as OnboardingObjective },
                    }))
                  }
                  className={`rounded-3xl border p-5 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors transition-shadow transition-transform duration-200 ease-out active:scale-[0.99] ${
                    draft.student.goal === value
                      ? "border-sky-500 bg-sky-50 shadow-md hover:shadow-lg"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                  }`}
                >
                  <div className="font-semibold">{option.title}</div>
                  <div className="mt-2 text-sm text-slate-600">{option.text}</div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {step === 5 ? (
          <section className="space-y-5">
            <h2 className="text-2xl font-bold">{renumberStepTitle(ui.step3.title, 5)}</h2>
            <p className="text-sm text-slate-600">{ui.step3.description}</p>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <div className="font-semibold">{ui.step3.confidenceTitle}</div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {Object.entries(ui.step3.confidenceOptions).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        student: { ...current.student, confidence: confidenceLabelToNumber(value as ConfidenceLabel) },
                      }))
                    }
                    className={`rounded-2xl border px-4 py-3 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors transition-shadow transition-transform duration-200 ease-out active:scale-[0.99] ${
                      confidenceNumberToLabel(draft.student.confidence) === value
                        ? "border-sky-500 bg-sky-50 text-sky-900 shadow-md hover:shadow-lg"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-slate-700 shadow-sm">{ui.step4.wowMessage}</div>
          </section>
        ) : null}

        {step === 6 ? (
          <section className="space-y-5">
            <h2 className="text-2xl font-bold">{renumberStepTitle(ui.step4.title, 6)}</h2>
            <p className="text-sm text-slate-600">{ui.step4.description}</p>
            {!activation ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 shadow-sm">
                <p><strong>Tutor principal:</strong> {`${formatGuardianRelationLabel(draft.primaryGuardian.relation)} ${draft.primaryGuardian.fullName}`.trim()}</p>
                <p className="mt-2"><strong>{ui.step6.summaryStudent}:</strong> {draft.student.fullName}</p>
                <p className="mt-2"><strong>{ui.step6.summarySubjects}:</strong> {draft.student.subjects.map((item) => subjects.find((subject) => subject.slug === item.subjectSlug)?.name ?? item.subjectSlug).join(", ")}</p>
                <p className="mt-2"><strong>{ui.step4.summaryObjective}:</strong> {ui.step2.objectives[draft.student.goal].title}</p>
                <p className="mt-2"><strong>{ui.step4.summaryConfidence}:</strong> {ui.step3.confidenceOptions[confidenceNumberToLabel(draft.student.confidence)]}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                  <div className="text-sm font-semibold text-emerald-900">{ui.step4.firstSessionLabel}</div>
                  <div className="mt-2 text-sm leading-7 text-slate-700">{activation.reply}</div>
                </div>
                <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                    <div className="text-sm font-semibold">{ui.step4.dailyPlanLabel}</div>
                    <div className="mt-3 space-y-2">
                      {activation.dailyPlan.tasks.map((task) => (
                        <div key={task.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                          {`${task.subject} - ${workspaceUi.dailyPlanTaskTypes[task.type]} - ${workspaceUi.dailyPlanDifficultyPrefix}${task.difficulty}`}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                    <div className="text-sm font-semibold">{ui.step4.nextActionsLabel}</div>
                    <div className="mt-3 space-y-2">
                      {activation.nextActions.map((action) => (
                        <div key={action} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                          {action}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        ) : null}

        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors transition-transform duration-200 active:scale-[0.99]"
            disabled={saving || Boolean(activation)}
          >
            {ui.back}
          </button>
          {step < 6 ? (
            <button
              type="button"
              onClick={() => {
                const validation = getStepValidation(step, draft);
                if (validation.valid) {
                  setError(null);
                  setStep((current) => Math.min(6, current + 1));
                } else {
                  setError(validation.message ?? ui.validationError);
                }
              }}
              className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors transition-transform duration-200 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {ui.next}
            </button>
          ) : activation ? (
            <button
              type="button"
              onClick={() => {
                window.location.href = buildMentoriaWorkspaceUrl(searchParams);
              }}
              className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors transition-transform duration-200 active:scale-[0.99]"
            >
              {ui.step4.enterAction}
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={finish}
              className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors transition-transform duration-200 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? ui.saving : ui.step4.launchAction}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
