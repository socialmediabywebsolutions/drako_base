// Dashboard privado — datos reales vía repositorios existentes (ver _lib/dashboard-data.ts).
import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import { listKnowledgeDocs } from "@/lib/socialflow/knowledge/repository";
import { resolveSocialContext, SocialContextError } from "@/lib/socialflow/repository";
import { getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";
import { getSocialFlowPlanDefinition, resolveSocialFlowPlanCode } from "@/lib/socialflow/billing/plans";
import { getWeeklyPublishStatus } from "@/lib/socialflow/billing/enforce";
import { isLinkedInConnectEnabled } from "@/lib/socialflow/linkedin/core";
import { getEmpresaChecklist } from "@/lib/socialflow/onboarding/checklistRepository";
import EmpresaChecklist from "@/components/socialflow/EmpresaChecklist";
import { emptyDashboardData, loadDashboardData, type DashboardData } from "./_lib/dashboard-data";
import { Greeting, WeekCalendar } from "./_components/dashboard-client";
import { FailedPostsPanel } from "./_components/FailedPostsPanel";
import { EngagementChart, FollowersChart, ViewsByPostChart } from "./_components/dashboard-charts";
import {
  Connections,
  NextSteps,
  PublishCta,
  RecentPosts,
  Section,
  StatCards,
  type NextStep,
  type StatCardModel,
} from "./_components/dashboard-sections";

const DEFAULT_SAAS_ID = "socialflow";

const nf = new Intl.NumberFormat("es-ES");

function buildStats(
  data: DashboardData,
  weekly: { used: number; limit: number } | null,
): StatCardModel[] {
  const igConnected = data.instagram === "connected";

  const instagram: StatCardModel = weekly
    ? {
        label: "Instagram esta semana",
        value: `${weekly.used} / ${weekly.limit}`,
        detail: "Publicaciones frente al límite de tu plan",
        ...(weekly.limit > 0 && weekly.used >= weekly.limit
          ? { status: "attention", statusLabel: "Límite semanal alcanzado" }
          : weekly.used === 0
            ? { status: "empty", statusLabel: "Sin publicaciones aún" }
            : { status: "good", statusLabel: "Dentro de tu cuota" }),
      }
    : { label: "Instagram esta semana", value: "—", detail: "No se pudo leer tu cuota", status: "empty", statusLabel: "Sin datos" };

  const scheduled: StatCardModel = {
    label: "Programadas · 7 días",
    value: nf.format(data.scheduledNext7Days),
    detail: "Publicaciones listas para salir",
    ...(data.scheduledNext7Days > 0
      ? { status: "good", statusLabel: "Calendario en marcha" }
      : { status: "empty", statusLabel: "Nada programado" }),
  };

  const { current, growth30d } = data.followers;
  const followers: StatCardModel = {
    label: "Seguidores",
    value: current !== null ? nf.format(current) : "—",
    detail: growth30d !== null ? `${growth30d > 0 ? "+" : ""}${nf.format(growth30d)} en 30 días` : "Total actual en Instagram",
    ...(current === null
      ? { status: "empty", statusLabel: igConnected ? "Recopilando datos" : "Instagram sin conectar" }
      : growth30d !== null && growth30d < 0
        ? { status: "attention", statusLabel: "Han bajado este mes" }
        : { status: "good", statusLabel: growth30d !== null && growth30d > 0 ? "Creciendo" : "Estable" }),
  };

  const eng = data.engagement30d;
  const engagement: StatCardModel = {
    label: "Engagement · 30 días",
    value: eng.total > 0 ? nf.format(eng.total) : "—",
    detail: "Likes + comentarios + shares",
    ...(eng.publishedPosts === 0
      ? { status: "empty", statusLabel: "Sin publicaciones en 30 días" }
      : eng.total === 0
        ? { status: "attention", statusLabel: "Aún sin interacciones" }
        : { status: "good", statusLabel: `${eng.publishedPosts} ${eng.publishedPosts === 1 ? "post publicado" : "posts publicados"}` }),
  };

  return [instagram, scheduled, followers, engagement];
}

function buildNextSteps(input: { hasKnowledge: boolean; data: DashboardData }): NextStep[] {
  const { hasKnowledge, data } = input;
  const steps: NextStep[] = [];

  if (!hasKnowledge) {
    steps.push({
      title: "Completa tu Base de conocimiento",
      description: "Cuanto más sepa SocialCors de tu marca, mejor será todo lo que crea para ti.",
      href: "/socialflow/knowledge",
      cta: "Completar",
    });
  }
  if (data.instagram !== "connected") {
    steps.push({
      title: data.instagram === "needs_reconnection" ? "Reconecta Instagram" : "Conecta Instagram",
      description: "Sin Instagram no podemos publicar por ti ni medir tus resultados.",
      href: "/socialflow/redes",
      cta: "Conectar",
    });
  }
  if (data.scheduledNext7Days === 0) {
    steps.push({
      title: data.totalPublishedEver === 0 ? "Crea tu primer contenido" : "Programa tu próximo contenido",
      description: "No tienes nada programado para los próximos 7 días.",
      href: "/socialflow/upload",
      cta: "Crear",
    });
  }
  if (steps.length === 0) {
    steps.push({
      title: "¿Qué publicas hoy?",
      description: "Todo está en orden. Sube una foto y SocialCors hace el resto.",
      href: "/socialflow/upload",
      cta: "Crear contenido",
    });
  }
  return steps.slice(0, 3);
}

export default async function SocialFlowDashboardPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const snapshot = await getChannelKnowledge(session.tenantId, DEFAULT_SAAS_ID);
  if (!snapshot.profile.onboardingCompletedAt) {
    redirect("/socialflow/onboarding");
  }

  const billingSnapshot = await getCanonicalBillingSnapshot({ tenantId: session.tenantId, saasSlug: "socialflow" });
  const planCode = resolveSocialFlowPlanCode(billingSnapshot.subscription);
  const planDefinition = getSocialFlowPlanDefinition(planCode);

  const [weeklyPublishStatus, knowledgeDocs] = await Promise.all([
    getWeeklyPublishStatus(session.tenantId, session.role).catch(() => null),
    listKnowledgeDocs(session.tenantId, DEFAULT_SAAS_ID).catch(() => null),
  ]);
  // Si no se puede leer la KB no se molesta al usuario con un aviso falso.
  const hasKnowledge = knowledgeDocs === null ? true : knowledgeDocs.length > 0;

  let data = emptyDashboardData();
  try {
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: DEFAULT_SAAS_ID });
    data = await loadDashboardData(ctx);
  } catch (error) {
    if (!(error instanceof SocialContextError)) {
      console.error("SOCIALFLOW_DASHBOARD_DATA_ERROR", error);
    }
  }

  let empresaChecklist: Awaited<ReturnType<typeof getEmpresaChecklist>> | null = null;
  if (session.accountType === "empresa") {
    try {
      empresaChecklist = await getEmpresaChecklist(session.tenantId, DEFAULT_SAAS_ID);
    } catch (error) {
      console.error("SOCIALFLOW_DASHBOARD_CHECKLIST_ERROR", error);
    }
  }
  const showChecklistWidget = Boolean(empresaChecklist && empresaChecklist.completedCount < empresaChecklist.totalCount);

  const firstName = session.name?.trim().split(/\s+/)[0] || snapshot.profile.brandName?.trim() || null;
  const stats = buildStats(data, weeklyPublishStatus ? { used: weeklyPublishStatus.instagram.used, limit: weeklyPublishStatus.instagram.limit } : null);
  const nextSteps = buildNextSteps({ hasKnowledge, data });

  return (
    <div className="space-y-6">
      {/* 1 · Cabecera */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Greeting name={firstName} />
          <p className="mt-2 text-sm text-gray-500">Esto es lo que está pasando hoy con tus redes.</p>
        </div>
        <span className="rounded-full border border-[#3b82f6]/40 bg-[#3b82f6]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#3b82f6]">
          Plan {planDefinition.label}
        </span>
      </header>

      {/* Posts sin imagen — solo se pinta si hay alguno */}
      <FailedPostsPanel />

      {/* 2 · Métricas principales */}
      <StatCards cards={stats} />

      {/* 3 · Gráficas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <FollowersChart history={data.followers.history} instagramConnected={data.instagram === "connected"} />
        <ViewsByPostChart posts={data.viewsByPost} />
      </div>
      <EngagementChart weeks={data.engagementByWeek} totals={data.engagement30d} />

      {/* 4 · Tu siguiente paso */}
      <NextSteps steps={nextSteps} />

      {showChecklistWidget && empresaChecklist && (
        <EmpresaChecklist
          items={empresaChecklist.items}
          completedCount={empresaChecklist.completedCount}
          totalCount={empresaChecklist.totalCount}
        />
      )}

      {/* 5 · CTA central */}
      <PublishCta />

      {/* 6 · Calendario semanal */}
      <Section title="Calendario semanal" subtitle="Tus próximos 7 días · contenido programado">
        <WeekCalendar posts={data.scheduledPosts} />
      </Section>

      {/* 7 · Últimas publicaciones */}
      <RecentPosts posts={data.recentPosts} />

      {/* 8 · Estado de conexiones */}
      <Connections instagram={data.instagram} linkedin={data.linkedin} linkedinAvailable={isLinkedInConnectEnabled()} />
    </div>
  );
}
