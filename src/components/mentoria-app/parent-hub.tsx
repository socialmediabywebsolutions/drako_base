"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WorkspaceShell } from "@/components/mentoria-app/workspace-shell";
import { ParentWeeklySummary } from "@/components/mentoria-app/parent-weekly-summary";
import { ParentStudentDashboard } from "@/components/mentoria-app/parent-student-dashboard";
import { getMicrocopy, getParentHubUiCopy, MENTORIA_PARENT_SLOT_A, MENTORIA_PARENT_SLOT_B } from "@/lib/mentoria/microcopy";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import {
  buildMentoriaSessionContract,
  buildMentoriaSessionModeOptions,
  resolveMentoriaSessionMode,
} from "@/lib/mentoria/session-modes";
import { buildGuardianViewModel } from "@/lib/mentoria/state/guardian-visibility-policy";
import { deriveStateActions } from "@/lib/mentoria/state/intervention-engine";
import { collectStudentSignals, evaluateStudentState } from "@/lib/mentoria/state/student-state-engine";
import type { GuardianViewModel } from "@/lib/mentoria/state/state-types";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type { DailyPlan, Insight, MentoriaBillingSummary, MentoriaFamilyStudent, MentoriaGrowthSummary, MentoriaGuardian, MentoriaGuardianStudentAccess, MentoriaIntervention, MentoriaProgress, MentoriaSessionContract, MentoriaSessionModeOption, StudentProfile, StudyPlan } from "@/lib/mentoria/types";

type ConnectedGuardianView = {
  id: string;
  fullName: string;
  email: string;
  relation: string;
  slot: "Parent A" | "Parent B";
  canManageSchedule: boolean;
};

type GuardianDraft = {
  id?: string | null;
  fullName: string;
  email: string;
  familyRelation?: MentoriaGuardian["familyRelation"];
  systemRole: MentoriaGuardian["systemRole"];
  access: {
    dailyStudyMinutes: number;
    supervisionLevel: MentoriaGuardianStudentAccess["supervisionLevel"];
    canViewFullProgress: boolean;
    canManageSchedule: boolean;
    notificationPreferences?: string[];
    isPrimaryContact?: boolean;
  };
};

function buildConnectedGuardians(input: {
  primaryGuardian: MentoriaGuardian | null;
  secondaryGuardians: MentoriaGuardian[];
  guardianStudentAccess: MentoriaGuardianStudentAccess[];
}): ConnectedGuardianView[] {
  const canonicalGuardians = [input.primaryGuardian, ...input.secondaryGuardians].filter((item): item is MentoriaGuardian => Boolean(item));

  return canonicalGuardians.map((guardian, index) => {
    const access = input.guardianStudentAccess.find((item) => item.guardianId === guardian.id) ?? null;
    return {
      id: guardian.id,
      fullName: guardian.name?.trim() || guardian.email,
      email: guardian.email,
      relation: guardian.systemRole === "primary_guardian" ? "Tutor principal" : "Tutor secundario",
      slot: guardian.systemRole === "primary_guardian" || index === 0 ? "Parent A" : "Parent B",
      canManageSchedule: access?.canManageSchedule ?? false,
    };
  });
}

export function MentoriaParentHub() {
  const searchParams = useSearchParams();
  const selectedStudentId = searchParams.get("studentId")?.trim() || null;
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [familyStudents, setFamilyStudents] = useState<MentoriaFamilyStudent[]>([]);
  const [primaryGuardian, setPrimaryGuardian] = useState<MentoriaGuardian | null>(null);
  const [secondaryGuardians, setSecondaryGuardians] = useState<MentoriaGuardian[]>([]);
  const [guardianStudentAccess, setGuardianStudentAccess] = useState<MentoriaGuardianStudentAccess[]>([]);
  const [progress, setProgress] = useState<MentoriaProgress[]>([]);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [evolution, setEvolution] = useState<StudentEvolutionProfile | null>(null);
  const [motivation, setMotivation] = useState<MotivationState | null>(null);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [billing, setBilling] = useState<MentoriaBillingSummary | null>(null);
  const [interventions, setInterventions] = useState<MentoriaIntervention[]>([]);
  const [growth, setGrowth] = useState<MentoriaGrowthSummary | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [guardianViewModel, setGuardianViewModel] = useState<GuardianViewModel | null>(null);
  const [primaryGuardianDraft, setPrimaryGuardianDraft] = useState<GuardianDraft>({
    fullName: "",
    email: "",
    systemRole: "primary_guardian",
    access: {
      dailyStudyMinutes: 45,
      supervisionLevel: "balanced",
      canViewFullProgress: true,
      canManageSchedule: true,
      notificationPreferences: ["progress", "planner"],
      isPrimaryContact: true,
    },
  });
  const [secondaryGuardianDraft, setSecondaryGuardianDraft] = useState<GuardianDraft>({
    fullName: "",
    email: "",
    systemRole: "secondary_guardian",
    access: {
      dailyStudyMinutes: 45,
      supervisionLevel: "light",
      canViewFullProgress: true,
      canManageSchedule: false,
      notificationPreferences: ["progress", "planner"],
      isPrimaryContact: false,
    },
  });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const scopedQuery = selectedStudentId ? `?studentId=${encodeURIComponent(selectedStudentId)}` : "";
      const [profileRes, progressRes, plannerRes, familyRes] = await Promise.all([
        fetch(`/api/mentoria/profile${scopedQuery}`, { cache: "no-store" }),
        fetch(`/api/mentoria/progress${scopedQuery}`, { cache: "no-store" }),
        fetch(`/api/mentoria/planner${scopedQuery}`, { cache: "no-store" }),
        fetch("/api/mentoria/family", { cache: "no-store" }),
      ]);
      if ([profileRes, progressRes, plannerRes, familyRes].some((response) => response.status === 401)) {
        window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/app/parents";
        return;
      }
      if ([profileRes, progressRes, plannerRes, familyRes].some((response) => response.status === 409)) {
        window.location.href = "/mentoria/onboarding";
        return;
      }
      if ([profileRes, progressRes, plannerRes].some((response) => response.status === 403)) {
        window.location.href = "/mentoria/app/parents";
        return;
      }
      const profileBody = (await profileRes.json()) as {
        student?: StudentProfile;
        familyStudents?: MentoriaFamilyStudent[];
        primaryGuardian?: MentoriaGuardian | null;
        secondaryGuardians?: MentoriaGuardian[];
        guardianStudentAccess?: MentoriaGuardianStudentAccess[];
        evolution?: StudentEvolutionProfile;
        motivation?: MotivationState;
        dailyPlan?: DailyPlan | null;
        billing?: MentoriaBillingSummary | null;
        interventions?: MentoriaIntervention[];
        growth?: MentoriaGrowthSummary | null;
        insights?: Insight[];
      };
      const progressBody = (await progressRes.json()) as { progress?: MentoriaProgress[] };
      const plannerBody = (await plannerRes.json()) as { plan?: StudyPlan | null };
      const familyBody = (await familyRes.json()) as { students?: MentoriaFamilyStudent[] };
      setStudent(profileBody.student ?? null);
      setFamilyStudents(profileBody.familyStudents ?? familyBody.students ?? []);
      setPrimaryGuardian(profileBody.primaryGuardian ?? null);
      setSecondaryGuardians(profileBody.secondaryGuardians ?? []);
      setGuardianStudentAccess(profileBody.guardianStudentAccess ?? []);
      setEvolution(profileBody.evolution ?? null);
      setMotivation(profileBody.motivation ?? null);
      setDailyPlan(profileBody.dailyPlan ?? null);
      setBilling(profileBody.billing ?? null);
      setInterventions((profileBody.interventions ?? []).filter((item) => item.status === "active"));
      setGrowth(profileBody.growth ?? null);
      setInsights(profileBody.insights ?? []);
      setProgress(progressBody.progress ?? []);
      setPlan(plannerBody.plan ?? null);
      if (profileBody.student?.id) {
        const signals = await collectStudentSignals(profileBody.student.id);
        const decision = evaluateStudentState(signals);
        const actions = deriveStateActions(decision);
        setGuardianViewModel(buildGuardianViewModel({ decision, actions }));
      }
      const canonicalGuardians = buildConnectedGuardians({
        primaryGuardian: profileBody.primaryGuardian ?? null,
        secondaryGuardians: profileBody.secondaryGuardians ?? [],
        guardianStudentAccess: profileBody.guardianStudentAccess ?? [],
      });
      const parentA = canonicalGuardians.find((item) => item.slot === MENTORIA_PARENT_SLOT_A);
      const parentB = canonicalGuardians.find((item) => item.slot === MENTORIA_PARENT_SLOT_B);
      setPrimaryGuardianDraft((current) => ({
        ...current,
        id: profileBody.primaryGuardian?.id ?? null,
        fullName: parentA?.fullName ?? "",
        email: parentA?.email ?? "",
        familyRelation: profileBody.primaryGuardian?.familyRelation ?? current.familyRelation,
      }));
      setSecondaryGuardianDraft((current) => ({
        ...current,
        id: profileBody.secondaryGuardians?.[0]?.id ?? null,
        fullName: parentB?.fullName ?? "",
        email: parentB?.email ?? "",
        familyRelation: profileBody.secondaryGuardians?.[0]?.familyRelation ?? current.familyRelation,
      }));
    })();
  }, [selectedStudentId]);

  async function saveGuardiansProfile() {
    if (!student) return;
    const response = await fetch("/api/mentoria/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        primaryGuardian: primaryGuardianDraft.fullName.trim() || primaryGuardianDraft.email.trim()
          ? primaryGuardianDraft
          : null,
        secondaryGuardians: secondaryGuardianDraft.fullName.trim() || secondaryGuardianDraft.email.trim()
          ? [secondaryGuardianDraft]
          : [],
      }),
    });
    if (response.ok) {
      const body = (await response.json()) as {
        primaryGuardian?: MentoriaGuardian | null;
        secondaryGuardians?: MentoriaGuardian[];
        guardianStudentAccess?: MentoriaGuardianStudentAccess[];
      };
      setPrimaryGuardian(body.primaryGuardian ?? null);
      setSecondaryGuardians(body.secondaryGuardians ?? []);
      setGuardianStudentAccess(body.guardianStudentAccess ?? []);
    }
  }

  const connectedGuardians = useMemo(
    () => buildConnectedGuardians({ primaryGuardian, secondaryGuardians, guardianStudentAccess }),
    [primaryGuardian, secondaryGuardians, guardianStudentAccess],
  );

  if (!student) {
    return null;
  }

  const stage = student.learningStage;
  const ui = getParentHubUiCopy(stage);
  const parentMessage = getMicrocopy(stage, "parent_message");
  const completedDailyTasks = dailyPlan?.tasks.filter((task) => task.completed) ?? [];
  const rawDailyCompliance = dailyPlan?.completionRate ?? 0;
  const dailyCompliance = Math.round(rawDailyCompliance > 1 ? rawDailyCompliance : rawDailyCompliance * 100);
  const nextDailyTask = dailyPlan?.tasks.find((task) => !task.completed && !dailyPlan.completedTaskIds.includes(task.id))
    ?? dailyPlan?.tasks.find((task) => !task.completed)
    ?? null;
  const emotionalSupportLabel = !evolution
    ? "Acompañamiento equilibrado"
    : evolution.frustrationLevel >= 0.66
      ? "Necesita calma y pasos pequeños"
      : evolution.consistencyScore >= 0.66
        ? "Está sosteniendo buen ritmo"
        : "Conviene proteger continuidad";
  const academicSupportLabel = progress.length > 0
    ? `${progress[0].subject?.name ?? ui.subjectFallbackLabel}: ${progress[0].masteryScore}% dominio, ${progress[0].confidenceScore}% confianza`
    : "Aún falta progreso consolidado por materia";
  const guardianPrimaryAction = guardianViewModel?.requiresIntervention
    ? "Acompañar hoy con una acción corta, concreta y sin añadir más tareas."
    : "Sostener el ritmo actual y preguntar por el siguiente paso, no por toda la semana.";
  const premiumRewardDays = growth?.rewardEntitlements.premiumAccessUntil
    ? Math.max(0, Math.ceil((new Date(growth.rewardEntitlements.premiumAccessUntil).getTime() - Date.now()) / 86400000))
    : 0;
  const parentPriorityItems = [
    guardianViewModel?.summary ?? emotionalSupportLabel,
    nextDailyTask
      ? `Hoy conviene priorizar ${nextDailyTask.subject} y no abrir mas frentes.`
      : "Hoy conviene sostener continuidad sin meter tareas extra.",
    insights[0]?.actions[0] ?? guardianPrimaryAction,
  ].filter((item): item is string => Boolean(item));
  const parentHelpActions = [
    "Pregunta por el siguiente paso concreto, no por toda la semana.",
    nextDailyTask
      ? `Ofrece 10 minutos de presencia tranquila antes de ${nextDailyTask.subject}.`
      : "Celebra el intento y deja que el alumno cierre un bloque pequeno.",
    guardianViewModel?.requiresIntervention
      ? "Reduce exigencia: una tarea corta, descanso y cierre claro."
      : "Manten el ritmo con una pregunta simple al terminar.",
  ];
  const familySessionMode = resolveMentoriaSessionMode({
    student,
    dailyPlan,
    activeTask: nextDailyTask,
    stateLabel: guardianViewModel?.summary ?? emotionalSupportLabel,
    currentTopic: nextDailyTask?.subject ?? progress[0]?.subject?.name ?? null,
    currentMessage: insights[0]?.summary ?? guardianPrimaryAction,
    recentActivityLabel: null,
  });
  const familySessionContract: MentoriaSessionContract = buildMentoriaSessionContract(
    familySessionMode,
    nextDailyTask ? "family_routine" : guardianViewModel?.requiresIntervention ? "student_state_signal" : "orchestrator_recommendation",
  );
  const familySessionOptions: MentoriaSessionModeOption[] = buildMentoriaSessionModeOptions({
    student,
    dailyPlan,
    activeTask: nextDailyTask,
    currentTopic: nextDailyTask?.subject ?? progress[0]?.subject?.name ?? null,
    currentMessage: guardianPrimaryAction,
    stateLabel: guardianViewModel?.summary ?? emotionalSupportLabel,
  });
  const familyFollowThroughItems = [
    nextDailyTask
      ? `Siguiente paso real: ${nextDailyTask.subject} · ${ui.dailyPlanTaskTypes[nextDailyTask.type]}.`
      : null,
    insights[0]?.summary ?? null,
    progress[0]
      ? `${progress[0].subject?.name ?? ui.subjectFallbackLabel}: ${progress[0].masteryScore}% dominio y ${progress[0].confidenceScore}% confianza.`
      : null,
    plan?.blocks?.[0]
      ? `${plan.blocks[0].day}: ${plan.blocks[0].title} · ${plan.blocks[0].durationMinutes} ${ui.blockDurationSuffix}.`
      : null,
  ].filter((item): item is string => Boolean(item)).slice(0, 3);

  async function startCheckout(plan: "pro" | "family") {
    const response = await fetch("/api/mentoria/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const body = (await response.json()) as { url?: string };
    if (response.ok && body.url) {
      window.location.href = body.url;
    }
  }

  async function openBillingPortal() {
    const response = await fetch("/api/mentoria/billing/portal", { method: "POST" });
    const body = (await response.json()) as { url?: string };
    if (response.ok && body.url) {
      window.location.href = body.url;
    }
  }

  async function createInvite() {
    const response = await fetch("/api/mentoria/growth/referrals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitedEmail: inviteEmail }),
    });
    const body = (await response.json()) as {
      inviteUrl?: string;
      message?: string;
      referralProfile?: MentoriaGrowthSummary["referralProfile"];
      referral?: MentoriaGrowthSummary["referrals"][number];
    };
    if (response.ok) {
      setInviteUrl(body.inviteUrl ?? null);
      setInviteMessage(body.message ?? null);
      if (growth && body.referralProfile && body.referral) {
        setGrowth({
          ...growth,
          referralProfile: body.referralProfile,
          referrals: [body.referral, ...growth.referrals],
        });
      }
      setInviteEmail("");
    }
  }

  async function createShare() {
    const response = await fetch("/api/mentoria/growth/share-progress", { method: "POST" });
    const body = (await response.json()) as {
      shareUrl?: string;
      message?: string;
      share?: MentoriaGrowthSummary["latestShare"];
    };
    if (response.ok) {
      setShareUrl(body.shareUrl ?? null);
      setShareMessage(body.message ?? null);
      if (growth) {
        setGrowth({
          ...growth,
          latestShare: body.share ?? growth.latestShare,
        });
      }
    }
  }

  async function copyText(value: string | null) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
  }

  return (
      <WorkspaceShell
      copilotMode="rail"
      copilotLabel="Guia familiar"
      leftNav={
        <div className="flex h-full flex-col bg-white">
          <div className="border-b border-slate-200 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Espacio familiar</div>
            <h1 className="mt-2 text-xl font-black text-slate-900">Familia</h1>
            <p className="mt-1 text-sm text-slate-600">{student.fullName} · {student.schoolYear}</p>
            <Link href={`/mentoria/app?studentId=${student.id}&viewer=guardian`} className="mt-4 inline-flex rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Abrir la pizarra
            </Link>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {familyStudents.length > 0 ? (
              <section>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Alumnos vinculados</div>
                <div className="mt-3 space-y-2">
                  {familyStudents.map((familyStudent) => {
                    const isActiveStudent = familyStudent.id === student.id;
                    return (
                      <Link
                        key={familyStudent.id}
                        href={`/mentoria/app/parents?studentId=${familyStudent.id}`}
                        className={`block rounded-lg border px-3 py-3 transition ${isActiveStudent ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                      >
                        <div className="text-sm font-semibold text-slate-900">{familyStudent.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{familyStudent.level ?? "Curso pendiente"}</div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Personas conectadas</div>
              <div className="mt-3 space-y-2">
                {connectedGuardians.length > 0 ? (
                  connectedGuardians.map((guardian) => (
                    <div key={guardian.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="text-sm font-semibold text-slate-900">{guardian.fullName}</div>
                      <div className="mt-1 text-xs text-slate-600">{guardian.relation}</div>
                      <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {guardian.canManageSchedule ? ui.parentViewManage : ui.parentViewReadOnly}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">
                    Aún no hay tutores conectados.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-lg bg-emerald-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Hoy importa</div>
              <p className="mt-2 text-sm text-emerald-950">{guardianPrimaryAction}</p>
            </section>

            <section className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Estado simple</div>
              <div className="mt-2">{emotionalSupportLabel}</div>
              <div className="mt-1">{academicSupportLabel}</div>
            </section>
          </div>
        </div>
      }
      centerBoard={
        <div className="min-h-full bg-slate-50 p-6">
          <div className="mx-auto max-w-5xl space-y-5">
            <header className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Perfil familiar conectado</div>
              <h2 className="mt-2 text-2xl font-black text-slate-900">{`${ui.headingPrefix} ${student.fullName}`}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{parentMessage}</p>
            </header>

            {familyStudents.length > 0 ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Alumno en foco</div>
                    <h3 className="mt-2 text-xl font-bold text-slate-900">{student.fullName}</h3>
                    <p className="mt-1 text-sm text-slate-600">{student.schoolYear}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/mentoria/app?studentId=${student.id}&viewer=guardian`} className="inline-flex rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-black">
                      Abrir su pizarra
                    </Link>
                    <Link href={`/mentoria/app/diario?studentId=${student.id}`} className="inline-flex rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      📓 Diario escolar
                    </Link>
                  </div>
                </div>
                {familyStudents.length > 1 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {familyStudents.map((familyStudent) => {
                      const isActiveStudent = familyStudent.id === student.id;
                      return (
                        <div key={familyStudent.id} className={`rounded-lg border p-4 ${isActiveStudent ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                          <div className="text-sm font-semibold text-slate-900">{familyStudent.name}</div>
                          <div className="mt-1 text-xs text-slate-500">{familyStudent.level ?? "Curso pendiente"}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {!isActiveStudent ? (
                              <Link href={`/mentoria/app/parents?studentId=${familyStudent.id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white">
                                Ver este alumno
                              </Link>
                            ) : null}
                            <Link href={`/mentoria/app?studentId=${familyStudent.id}&viewer=guardian`} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-white">
                              Abrir pizarra
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            ) : null}

            {/* Resumen semanal — visible para el padre */}
            <ParentWeeklySummary studentId={selectedStudentId ?? undefined} />

            {/* Dashboard completo del alumno: notas, materias, asistencia, comportamiento, estado IA */}
            <ParentStudentDashboard studentId={selectedStudentId ?? student.id} />

            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Estado real del alumno</div>
                  <h3 className="mt-2 text-xl font-bold text-slate-900">{guardianViewModel?.summary ?? "Seguimiento preparado"}</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {guardianViewModel?.message ?? "Cuando el alumno avance en sesiones, aquí verás la lectura útil para acompañar sin invadir."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Prioridad {guardianViewModel?.priority ?? "normal"}</span>
                  <span className={`rounded-full px-3 py-1 ${guardianViewModel?.requiresIntervention ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>
                    {guardianViewModel?.requiresIntervention ? "Necesita apoyo hoy" : "Sin intervención urgente"}
                  </span>
                </div>
              </div>
              <div className="mt-5 rounded-lg bg-emerald-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Apoyo recomendado</div>
                <p className="mt-2 text-sm leading-6 text-emerald-950">{guardianPrimaryAction}</p>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Modo que más ayuda hoy</div>
                  <h3 className="mt-2 text-xl font-bold text-slate-900">{familySessionContract.headline}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{familySessionContract.subheadline}</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">Lo que conviene priorizar</div>
                      <div className="mt-2">{familySessionContract.objective}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                      <div className="font-semibold text-slate-900">Cómo encaja la familia</div>
                      <div className="mt-2">{familySessionContract.familyRole}</div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
                  Modo sugerido: {familySessionContract.label}
                </div>
              </div>
              <div className="mt-5 rounded-lg bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Cómo se traduce hoy</div>
                <div className="mt-3 space-y-2 text-sm text-slate-700">
                  {familySessionOptions.slice(0, 3).map((option) => (
                    <div key={option.mode} className={`rounded-lg px-3 py-3 ${option.mode === familySessionContract.mode ? "bg-emerald-50 text-emerald-950" : "bg-white"}`}>
                      <span className="font-semibold">{option.label}</span>: {option.description}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {dailyPlan ? (
              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{ui.dailyPlanTitle}</h3>
                    <p className="mt-2 text-sm text-slate-600">{dailyPlan.adaptationReason}</p>
                  </div>
                  <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">
                    {dailyCompliance}% · {completedDailyTasks.length}/{dailyPlan.tasks.length} tareas
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {dailyPlan.tasks.map((task) => {
                    const isCompleted = task.completed || dailyPlan.completedTaskIds.includes(task.id);
                    return (
                      <div key={task.id} className={`rounded-lg border p-4 ${isCompleted ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                        <div className="text-sm font-semibold text-slate-900">{task.subject}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          {ui.dailyPlanTaskTypes[task.type]} · {ui.dailyPlanDifficultyPrefix}{task.difficulty}
                        </div>
                        <div className="mt-3 text-xs font-semibold text-slate-500">{isCompleted ? "Ya cerrada" : "Pendiente"}</div>
                      </div>
                    );
                  })}
                </div>
                {nextDailyTask ? (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                    Próxima prioridad: {nextDailyTask.subject} · {ui.dailyPlanTaskTypes[nextDailyTask.type]}.
                  </div>
                ) : null}
              </section>
            ) : null}

            {familyFollowThroughItems.length > 0 ? (
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-lg font-bold text-slate-900">Qué conviene sostener ahora</h3>
                <p className="mt-2 text-sm text-slate-600">Mantén el foco en el siguiente paso real del alumno y evita abrir un seguimiento paralelo.</p>
                <div className="mt-4 space-y-3">
                  {familyFollowThroughItems.map((item) => (
                    <div key={item} className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      }
      rightCopilot={
        <div className="flex h-full min-h-0 flex-col bg-white">
          <header className="border-b border-slate-200 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Orquestador familiar</div>
            <h2 className="mt-1 text-base font-semibold text-slate-900">Qué conviene hacer</h2>
            <p className="mt-1 text-xs text-slate-500">Lectura accionable para padres/tutores, conectada al alumno.</p>
          </header>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Mensaje principal</div>
              <p className="mt-2 text-sm leading-6 text-emerald-950">{guardianPrimaryAction}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Acompañamiento de hoy</div>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {parentPriorityItems.slice(0, 3).map((item, index) => (
                  <div key={`${item}-${index}`} className="rounded-lg bg-slate-50 px-3 py-2">
                    {item}
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {parentHelpActions.map((item, index) => (
                  <div key={`${item}-${index}`} className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-950">
                    {index + 1}. {item}
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                Si hoy toca <span className="font-semibold">{familySessionContract.label}</span>, ayuda más una presencia breve y tranquila que abrir todos los frentes a la vez.
              </div>
              {motivation ? (
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Lectura simple: lleva {motivation.streak} dias de ritmo; usalo para animar, no para presionar.
                </p>
              ) : null}
            </div>

            {interventions.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">{ui.alertsTitle}</div>
                <div className="mt-3 space-y-3">
                  {interventions.slice(0, 2).map((item) => (
                    <div key={item.id} className="text-sm leading-6 text-amber-950">
                      <div className="font-semibold">{item.summary}</div>
                      {item.recommendations[0] ? <div className="mt-1">{item.recommendations[0]}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">{ui.configureTitle}</h3>
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-xs font-semibold text-slate-600">Tutor principal</div>
                  <input value={primaryGuardianDraft.fullName} onChange={(event) => setPrimaryGuardianDraft((current) => ({ ...current, fullName: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder={ui.fullNamePlaceholder} />
                  <input value={primaryGuardianDraft.email} onChange={(event) => setPrimaryGuardianDraft((current) => ({ ...current, email: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder={ui.emailPlaceholder} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-600">Segundo tutor</div>
                  <input value={secondaryGuardianDraft.fullName} onChange={(event) => setSecondaryGuardianDraft((current) => ({ ...current, fullName: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder={ui.fullNamePlaceholder} />
                  <input value={secondaryGuardianDraft.email} onChange={(event) => setSecondaryGuardianDraft((current) => ({ ...current, email: event.target.value }))} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder={ui.emailPlaceholder} />
                </div>
              </div>
              <button onClick={saveGuardiansProfile} className="mt-4 rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-black">
                {ui.saveAction}
              </button>
            </section>

            {billing ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900">{ui.billingTitle}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-600">
                  {`${billing.planLabel} · sesiones ${billing.usage.guidedSessionsToday}/${billing.limits.guidedSessionsPerDay} · practicas ${billing.usage.exercisesToday}/${billing.limits.exercisesPerDay}`}
                </p>
                {billing.paywall ? <p className="mt-3 text-xs text-amber-700">{billing.paywall.message}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {billing.paywall?.canManageBilling ? (
                    <button onClick={() => startCheckout(billing.paywall?.recommendedPlan ?? "pro")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
                      {ui.billingUpgradeAction}
                    </button>
                  ) : null}
                  {billing.planCode !== "free" ? (
                    <button onClick={openBillingPortal} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                      {ui.billingManageAction}
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}

            {growth ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900">{ui.growthTitle}</h3>
                <p className="mt-2 text-xs text-slate-600">{growth.recommendedShareMessage}</p>
                <div className="mt-3 text-xs text-slate-500">{ui.rewardDaysLabel}: {premiumRewardDays}</div>
                <input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder={ui.invitePlaceholder}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={createInvite} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                    {ui.inviteAction}
                  </button>
                  <button onClick={createShare} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                    {ui.shareProgressAction}
                  </button>
                  {inviteMessage ? <button onClick={() => copyText(inviteMessage)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">{ui.copyAction}</button> : null}
                  {shareMessage ? <button onClick={() => copyText(shareMessage)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">{ui.copyAction}</button> : null}
                </div>
                {inviteUrl ? <div className="mt-3 break-all text-xs text-slate-500">{inviteUrl}</div> : null}
                {(shareUrl || growth.latestShare) ? <div className="mt-3 break-all text-xs text-slate-500">{shareUrl ?? `${window.location.origin}/mentoria/share/${growth.latestShare?.shareCode}`}</div> : null}
              </section>
            ) : null}
          </div>
        </div>
      }
    />
  );

}
