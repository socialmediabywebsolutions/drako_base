import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import {
  __resetDemoTenantStateForDev,
  exportDemoTenantState,
  upsertDemoSaasSocialCampaign,
  upsertDemoSaasSocialPost,
} from "@/lib/admin/demo-data";
import { resolveSocialContext, runSocialSchedulerSimulation } from "@/lib/social/repository";

async function main() {
  if (process.env.NODE_ENV !== "development") {
    // eslint-disable-next-line no-console
    console.error("This validator must be run in development (NODE_ENV=development)");
    process.exit(1);
  }

  const tenantId = DEMO_TENANT_ID;
  const saasId = "socialflow";

  // eslint-disable-next-line no-console
  console.log("[SOCIALFLOW_VALIDATE] Starting validation for tenant", tenantId, "saasId", saasId);

  // Limpia el estado demo en memoria para simular un arranque limpio
  __resetDemoTenantStateForDev(tenantId);

  const ctx = await resolveSocialContext({ tenantId, saasId, env: null });

  // 1. Crear campaña demo directamente en demo-data
  const campaignName = `Campaña Persistencia ${Date.now()}`;
  const campaign = upsertDemoSaasSocialCampaign(tenantId, {
    id: undefined,
    saas_id: saasId,
    name: campaignName,
    objective: "AWARENESS",
    status: "ACTIVE",
    target_segment: "DEFAULT",
    start_date: null,
    end_date: null,
    budget_estimate: null,
    notes: null,
  });

  const campaignId = campaign.id;

  // 2. Crear post programado ligado a campaña
  const post = upsertDemoSaasSocialPost(tenantId, {
    id: undefined,
    saas_id: saasId,
    campaign_id: campaignId,
    provider: "LINKEDIN",
    content_type: "FEED",
    title: "Post Persistente",
    body: "Contenido demo persistente",
    image_hint: null,
    status: "SCHEDULED",
    scheduled_at: null,
    posted_at: null,
    external_post_id: null,
    metadata: null,
  });

  const postId = post.id;

  // 3. Exportar estado demo y comprobar campañas/posts en memoria
  const snapshot1 = exportDemoTenantState(tenantId);

  const hasCampaign = snapshot1.saasSocialCampaigns.some((c) => c.id === campaignId);
  const hasPost = snapshot1.saasSocialPosts.some((p) => p.id === postId);

  // eslint-disable-next-line no-console
  console.log("[SOCIALFLOW_VALIDATE] After first creation", {
    campaigns: snapshot1.saasSocialCampaigns.length,
    posts: snapshot1.saasSocialPosts.length,
    hasCampaign,
    hasPost,
  });

  // 4. Simular reload: limpiar store y volver a acceder al estado
  __resetDemoTenantStateForDev(tenantId);
  const snapshotReload = exportDemoTenantState(tenantId);

  const hasCampaignReload = snapshotReload.saasSocialCampaigns.some((c) => c.id === campaignId);
  const hasPostReload = snapshotReload.saasSocialPosts.some((p) => p.id === postId);

  // eslint-disable-next-line no-console
  console.log("[SOCIALFLOW_VALIDATE] After simulated reload", {
    campaigns: snapshotReload.saasSocialCampaigns.length,
    posts: snapshotReload.saasSocialPosts.length,
    hasCampaignReload,
    hasPostReload,
  });

  // 5. Crear post con scheduledAt en el pasado
  const scheduledPost = upsertDemoSaasSocialPost(tenantId, {
    id: undefined,
    saas_id: saasId,
    campaign_id: campaignId,
    provider: "LINKEDIN",
    content_type: "FEED",
    title: "Post Scheduler",
    body: "Contenido para scheduler",
    image_hint: null,
    status: "SCHEDULED",
    scheduled_at: new Date(Date.now() - 60_000).toISOString(),
    posted_at: null,
    external_post_id: null,
    metadata: null,
  });

  const scheduledPostId = scheduledPost.id;

  // 6. Ejecutar scheduler demo en el mismo proceso
  await runSocialSchedulerSimulation(ctx);

  const snapshotAfterScheduler = exportDemoTenantState(tenantId);
  const scheduledPostAfter = snapshotAfterScheduler.saasSocialPosts.find((p) => p.id === scheduledPostId);

  const schedulerOk =
    !!scheduledPostAfter &&
    (scheduledPostAfter.status === "POSTED" || scheduledPostAfter.status === "PUBLISHED") &&
    scheduledPostAfter.posted_at !== null;

  // eslint-disable-next-line no-console
  console.log("[SOCIALFLOW_VALIDATE] After scheduler", {
    postId: scheduledPostId,
    status: scheduledPostAfter?.status,
    postedAt: scheduledPostAfter?.posted_at,
    schedulerOk,
  });

  if (!hasCampaign || !hasPost || !hasCampaignReload || !hasPostReload || !schedulerOk) {
    // eslint-disable-next-line no-console
    console.error("[SOCIALFLOW_VALIDATE] Validation failed", {
      hasCampaign,
      hasPost,
      hasCampaignReload,
      hasPostReload,
      schedulerOk,
    });
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(
    "[SOCIALFLOW_VALIDATE] SUCCESS: snapshot contains campaign/post before and after reload and scheduler changes are persisted",
  );
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
