"use client";

import { useEffect, useState } from "react";
import { getMicrocopy, getParentHubUiCopy, MENTORIA_PARENT_SLOT_A, MENTORIA_PARENT_SLOT_B } from "@/lib/mentoria/microcopy";
import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import type { StudentEvolutionProfile } from "@/lib/mentoria/student-evolution";
import type { DailyPlan, Insight, MentoriaBillingSummary, MentoriaGrowthSummary, MentoriaIntervention, MentoriaProgress, ParentAccount, StudentProfile, StudyPlan } from "@/lib/mentoria/types";

export function MentoriaParentHub() {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [parents, setParents] = useState<ParentAccount[]>([]);
  const [progress, setProgress] = useState<MentoriaProgress[]>([]);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [evolution, setEvolution] = useState<StudentEvolutionProfile | null>(null);
  const [motivation, setMotivation] = useState<MotivationState | null>(null);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(null);
  const [billing, setBilling] = useState<MentoriaBillingSummary | null>(null);
  const [interventions, setInterventions] = useState<MentoriaIntervention[]>([]);
  const [growth, setGrowth] = useState<MentoriaGrowthSummary | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [parentAName, setParentAName] = useState("");
  const [parentAEmail, setParentAEmail] = useState("");
  const [parentBName, setParentBName] = useState("");
  const [parentBEmail, setParentBEmail] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [profileRes, progressRes, plannerRes] = await Promise.all([
        fetch("/api/mentoria/profile", { cache: "no-store" }),
        fetch("/api/mentoria/progress", { cache: "no-store" }),
        fetch("/api/mentoria/planner", { cache: "no-store" }),
      ]);
      if ([profileRes, progressRes, plannerRes].some((response) => response.status === 401)) {
        window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/app/parents";
        return;
      }
      if ([profileRes, progressRes, plannerRes].some((response) => response.status === 409)) {
        window.location.href = "/mentoria/onboarding";
        return;
      }
      const profileBody = (await profileRes.json()) as {
        student?: StudentProfile;
        parents?: ParentAccount[];
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
      setStudent(profileBody.student ?? null);
      setParents(profileBody.parents ?? []);
      setEvolution(profileBody.evolution ?? null);
      setMotivation(profileBody.motivation ?? null);
      setDailyPlan(profileBody.dailyPlan ?? null);
      setBilling(profileBody.billing ?? null);
      setInterventions((profileBody.interventions ?? []).filter((item) => item.status === "active"));
      setGrowth(profileBody.growth ?? null);
      setInsights(profileBody.insights ?? []);
      setProgress(progressBody.progress ?? []);
      setPlan(plannerBody.plan ?? null);
      const parentA = (profileBody.parents ?? []).find((item) => item.relation === MENTORIA_PARENT_SLOT_A);
      const parentB = (profileBody.parents ?? []).find((item) => item.relation === MENTORIA_PARENT_SLOT_B);
      setParentAName(parentA?.fullName ?? "");
      setParentAEmail(parentA?.email ?? "");
      setParentBName(parentB?.fullName ?? "");
      setParentBEmail(parentB?.email ?? "");
    })();
  }, []);

  async function saveParents() {
    if (!student) return;
    const response = await fetch("/api/mentoria/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parents: [
          {
            slot: MENTORIA_PARENT_SLOT_A,
            fullName: parentAName,
            email: parentAEmail,
            dailyStudyMinutes: 45,
            supervisionLevel: "balanced",
            canViewFullProgress: true,
            canManageSchedule: true,
          },
          {
            slot: MENTORIA_PARENT_SLOT_B,
            fullName: parentBName,
            email: parentBEmail,
            dailyStudyMinutes: 45,
            supervisionLevel: "light",
            canViewFullProgress: true,
            canManageSchedule: false,
          },
        ],
      }),
    });
    if (response.ok) {
      const body = (await response.json()) as { parents?: ParentAccount[] };
      setParents(body.parents ?? []);
    }
  }

  if (!student) {
    return null;
  }

  const stage = student.learningStage;
  const ui = getParentHubUiCopy(stage);
  const parentMessage = getMicrocopy(stage, "parent_message");
  const completedDailyTasks = dailyPlan?.tasks.filter((task) => task.completed) ?? [];
  const dailyCompliance = Math.round((dailyPlan?.completionRate ?? 0) * 100);
  const premiumRewardDays = growth?.rewardEntitlements.premiumAccessUntil
    ? Math.max(0, Math.ceil((new Date(growth.rewardEntitlements.premiumAccessUntil).getTime() - Date.now()) / 86400000))
    : 0;

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
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-sky-300">{ui.badge}</p>
          <h1 className="mt-3 text-4xl font-black">{`${ui.headingPrefix} ${student.fullName}`}</h1>
          <p className="mt-2 text-sm text-slate-300">{parentMessage}</p>
        </div>

        {billing ? (
          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-xl font-bold">{ui.billingTitle}</h2>
                <p className="mt-2 text-sm text-slate-300">
                  {`${billing.planLabel} · sesiones ${billing.usage.guidedSessionsToday}/${billing.limits.guidedSessionsPerDay} · practicas ${billing.usage.exercisesToday}/${billing.limits.exercisesPerDay}`}
                </p>
                {billing.paywall ? <p className="mt-3 text-sm text-amber-300">{billing.paywall.message}</p> : null}
              </div>
              <div className="flex flex-wrap gap-3">
                {billing.paywall?.canManageBilling ? (
                  <button
                    onClick={() => startCheckout(billing.paywall?.recommendedPlan ?? "pro")}
                    className="rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950"
                  >
                    {ui.billingUpgradeAction}
                  </button>
                ) : null}
                {billing.planCode !== "free" ? (
                  <button onClick={openBillingPortal} className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold">
                    {ui.billingManageAction}
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {parents.map((parent) => (
            <div key={parent.id} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
              <div className="text-sm font-semibold">{parent.fullName}</div>
              <div className="mt-1 text-sm text-slate-300">{parent.relation}</div>
              <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
                {parent.canManageSchedule ? ui.parentViewManage : ui.parentViewReadOnly}
              </div>
            </div>
          ))}
        </div>

        {insights.length > 0 ? (
          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold">{ui.recommendationsTitle}</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {insights.map((insight) => (
                <div key={insight.id} className="rounded-3xl bg-slate-900 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{insight.category}</div>
                  <div className="mt-2 text-base font-semibold">{insight.title}</div>
                  <p className="mt-2 text-sm text-slate-300">{insight.summary}</p>
                  <div className="mt-3 space-y-2">
                    {insight.actions.map((action) => (
                      <div key={action} className="rounded-2xl bg-white/5 px-3 py-2 text-sm text-slate-200">
                        {action}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {dailyPlan ? (
          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold">{ui.dailyPlanTitle}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.dailyPlanComplianceLabel}</div>
                <div className="mt-2 text-lg font-bold">{`${dailyCompliance}%`}</div>
              </div>
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.dailyPlanDurationLabel}</div>
                <div className="mt-2 text-lg font-bold">{`${dailyPlan.recommendedDuration} ${ui.blockDurationSuffix}`}</div>
              </div>
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.dailyPlanPriorityLabel}</div>
                <div className="mt-2 text-lg font-bold">{ui.dailyPlanPriorityValues[dailyPlan.priority]}</div>
              </div>
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.dailyPlanConsistencyLabel}</div>
                <div className="mt-2 text-lg font-bold">{`${Math.round((evolution?.consistencyScore ?? 0) * 100)}%`}</div>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.dailyPlanReasonLabel}</div>
                <div className="mt-2 text-sm text-slate-200">{dailyPlan.adaptationReason}</div>
                <div className="mt-4 space-y-2">
                  {dailyPlan.tasks.map((task) => (
                    <div key={task.id} className="rounded-2xl border border-white/10 px-4 py-3 text-sm">
                      {`${task.subject} · ${ui.dailyPlanTaskTypes[task.type]} · ${ui.dailyPlanDifficultyPrefix}${task.difficulty}`}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.dailyPlanCompletedLabel}</div>
                <div className="mt-3 space-y-2">
                  {completedDailyTasks.length > 0 ? (
                    completedDailyTasks.map((task) => (
                      <div key={task.id} className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                        {`${task.subject} · ${ui.dailyPlanTaskTypes[task.type]}`}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300">{ui.dailyPlanCompletedEmpty}</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold">{ui.metricsTitle}</h2>
            <div className="mt-4 space-y-3">
              {progress.map((item) => (
                <div key={item.id} className="rounded-3xl bg-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <span>{item.subject?.name ?? ui.subjectFallbackLabel}</span>
                    <span className="text-sm text-slate-400">{`${item.masteryScore}%`}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">{`${ui.confidenceLabel} ${item.confidenceScore}% - ${ui.sessionsLabel} ${item.sessionsCompleted} - ${ui.exercisesLabel} ${item.exercisesCompleted}`}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold">{ui.configuredUseTitle}</h2>
            <div className="mt-4 rounded-3xl bg-slate-900 p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">{ui.weeklyPlanLabel}</div>
              <div className="mt-2 text-lg font-semibold">{plan?.goalsSummary ?? ui.noPlan}</div>
              <div className="mt-4 space-y-2">
                {(plan?.blocks ?? []).map((block) => (
                  <div key={block.id} className="rounded-2xl border border-white/10 px-4 py-3 text-sm">
                    {`${block.day}: ${block.title} - ${block.durationMinutes} ${ui.blockDurationSuffix}`}
                  </div>
                ))}
              </div>
            </div>
            <a href="/mentoria/app" className="mt-4 inline-block text-sm font-semibold text-sky-300">
              {ui.backAction}
            </a>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold">{ui.alertsTitle}</h2>
            <div className="mt-4 space-y-3">
              {billing?.features.advancedParentInsights && interventions.length > 0 ? (
                interventions.map((item) => (
                  <div key={item.id} className="rounded-3xl bg-slate-900 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{item.summary}</div>
                      <div className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-sky-300">
                        {`${ui.severityLabel} ${item.severity}`}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-3xl bg-slate-900 p-4 text-sm text-slate-300">{ui.noAlerts}</div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold">{ui.recommendationsTitle}</h2>
            <div className="mt-4 rounded-3xl bg-slate-900 p-5">
              {billing?.features.advancedParentInsights && interventions.length > 0 ? (
                <div className="space-y-3 text-sm text-slate-200">
                  {Array.from(new Set(interventions.flatMap((item) => item.recommendations))).slice(0, 6).map((recommendation) => (
                    <div key={recommendation} className="rounded-2xl border border-white/10 px-4 py-3">
                      {recommendation}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-300">{billing?.features.advancedParentInsights ? ui.noRecommendations : (billing?.paywall?.message ?? ui.noRecommendations)}</div>
              )}
            </div>
          </section>
        </div>

        {billing?.features.fullParentHub && evolution ? (
          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold">{ui.evolutionSummaryTitle}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.frustrationLabel}</div>
                <div className="mt-2 text-2xl font-bold">{`${Math.round(evolution.frustrationLevel * 100)}%`}</div>
              </div>
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.consistencyStateLabel}</div>
                <div className="mt-2 text-2xl font-bold">{`${Math.round(evolution.consistencyScore * 100)}%`}</div>
              </div>
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.progressionLabel}</div>
                <div className="mt-2 text-2xl font-bold">{`${Math.round(evolution.progressionVelocity * 100)}%`}</div>
              </div>
            </div>
          </section>
        ) : null}

        {billing?.features.fullParentHub && motivation ? (
          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold">{ui.motivationTitle}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.motivationProfileLabel}</div>
                <div className="mt-2 text-lg font-bold">{ui.motivationProfileValues[motivation.motivationProfile]}</div>
              </div>
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.streakLabel}</div>
                <div className="mt-2 text-lg font-bold">{motivation.streak}</div>
              </div>
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.effortLabel}</div>
                <div className="mt-2 text-lg font-bold">{`${Math.round(motivation.effortScore * 100)}%`}</div>
              </div>
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.rewardPointsLabel}</div>
                <div className="mt-2 text-lg font-bold">{motivation.rewardPoints}</div>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.levelLabel}</div>
                <div className="mt-2 text-lg font-bold">{motivation.level}</div>
              </div>
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.achievementsTitle}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {motivation.achievements.length > 0 ? (
                    motivation.achievements.slice(0, 6).map((achievement) => (
                      <div key={achievement} className="rounded-full border border-white/10 px-3 py-2 text-sm">
                        {achievement}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-300">{ui.noAchievements}</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {growth ? (
          <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-bold">{ui.growthTitle}</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.referralCodeLabel}</div>
                <div className="mt-2 text-lg font-bold">{growth.referralProfile.referralCode}</div>
              </div>
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.rewardDaysLabel}</div>
                <div className="mt-2 text-lg font-bold">{premiumRewardDays}</div>
              </div>
              <div className="rounded-3xl bg-slate-900 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{ui.convertedReferralsLabel}</div>
                <div className="mt-2 text-lg font-bold">{growth.referralProfile.convertedInvites}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl bg-slate-900 p-5">
                <div className="text-sm font-semibold">{ui.recommendedInviteLabel}</div>
                <div className="mt-2 text-sm text-slate-300">{growth.recommendedInviteMessage}</div>
                <input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm"
                  placeholder={ui.invitePlaceholder}
                />
                <div className="mt-3 flex flex-wrap gap-3">
                  <button onClick={createInvite} className="rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950">
                    {ui.inviteAction}
                  </button>
                  {inviteMessage ? (
                    <button onClick={() => copyText(inviteMessage)} className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold">
                      {ui.copyAction}
                    </button>
                  ) : null}
                </div>
                {inviteUrl ? (
                  <div className="mt-4 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300">
                    <div className="font-semibold text-white">{ui.inviteReadyLabel}</div>
                    <div className="mt-2 break-all">{inviteUrl}</div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-3xl bg-slate-900 p-5">
                <div className="text-sm font-semibold">{ui.recommendedShareLabel}</div>
                <div className="mt-2 text-sm text-slate-300">{growth.recommendedShareMessage}</div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button onClick={createShare} className="rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950">
                    {ui.shareProgressAction}
                  </button>
                  {shareMessage ? (
                    <button onClick={() => copyText(shareMessage)} className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold">
                      {ui.copyAction}
                    </button>
                  ) : null}
                </div>
                {(shareUrl || growth.latestShare) ? (
                  <div className="mt-4 rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300">
                    <div className="font-semibold text-white">{ui.shareLinkLabel}</div>
                    <div className="mt-2 break-all">{shareUrl ?? `${window.location.origin}/mentoria/share/${growth.latestShare?.shareCode}`}</div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-bold">{ui.configureTitle}</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl bg-slate-900 p-4">
              <div className="text-sm font-semibold">{ui.parentSlotA}</div>
              <input value={parentAName} onChange={(event) => setParentAName(event.target.value)} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm" placeholder={ui.fullNamePlaceholder} />
              <input value={parentAEmail} onChange={(event) => setParentAEmail(event.target.value)} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm" placeholder={ui.emailPlaceholder} />
            </div>
            <div className="rounded-3xl bg-slate-900 p-4">
              <div className="text-sm font-semibold">{ui.parentSlotB}</div>
              <input value={parentBName} onChange={(event) => setParentBName(event.target.value)} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm" placeholder={ui.fullNamePlaceholder} />
              <input value={parentBEmail} onChange={(event) => setParentBEmail(event.target.value)} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm" placeholder={ui.emailPlaceholder} />
            </div>
          </div>
          <button onClick={saveParents} className="mt-4 rounded-full bg-sky-400 px-5 py-3 text-sm font-semibold text-slate-950">
            {ui.saveAction}
          </button>
        </section>
      </div>
    </div>
  );
}
