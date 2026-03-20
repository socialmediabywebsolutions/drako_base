import {
  __resetDemoTenantStateForDev,
  exportDemoTenantState,
  upsertDemoSaasSocialCampaign,
  upsertDemoSaasSocialPost,
} from "@/lib/admin/demo-data";
import { resolveSocialContext, runSocialSchedulerSimulation } from "@/lib/social/repository";

const DEMO_TENANT_ID = "demo_tenant_id";
const DEMO_SAAS_ID = "socialflow";

async function main() {
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "[SOCIALFLOW_VALIDATE] ERROR: This validator must be run in development (NODE_ENV=development)",
    );
    process.exit(1);
  }

  const tenantId = DEMO_TENANT_ID;
  const saasId = DEMO_SAAS_ID;

  console.log("[SOCIALFLOW_VALIDATE] Starting validation", { tenantId, saasId });

  // 1. Limpia el estado demo en memoria para simular un arranque limpio
  console.log("[SOCIALFLOW_VALIDATE] Resetting demo tenant state for dev");
  __resetDemoTenantStateForDev(tenantId);

  // 2. Resuelve el contexto SocialFlow en modo demo (sin HTTP)
  console.log("[SOCIALFLOW_VALIDATE] Resolving Social context");
  const ctx = await resolveSocialContext({ tenantId, saasId, env: null });

  // 3. Crear campaña demo directamente en demo-data (sin id)
  const campaignName = `Campaña Persistencia ${Date.now()}`;
  console.log("[SOCIALFLOW_VALIDATE] Creating demo campaign", { campaignName });
  const campaign = upsertDemoSaasSocialCampaign(tenantId, {
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
  if (!campaignId) {
    console.error("[SOCIALFLOW_VALIDATE] ERROR: Created campaign has no id");
    process.exit(1);
  }

  console.log("[SOCIALFLOW_VALIDATE] Campaign created", {
    campaignId,
    status: campaign.status,
  });

  // 4. Crear post programado ligado a campaña (sin id)
  console.log("[SOCIALFLOW_VALIDATE] Creating demo post for campaign", { campaignId });
  const post = upsertDemoSaasSocialPost(tenantId, {
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
  if (!postId) {
    console.error("[SOCIALFLOW_VALIDATE] ERROR: Created post has no id");
    process.exit(1);
  }

  console.log("[SOCIALFLOW_VALIDATE] Post created", {
    postId,
    campaignId,
    status: post.status,
  });

  // 5. Exportar estado demo y comprobar campañas/posts en memoria (y snapshot en disco)
  console.log("[SOCIALFLOW_VALIDATE] Exporting tenant state after first creation");
  const snapshot1 = exportDemoTenantState(tenantId);

  const hasCampaign = snapshot1.saasSocialCampaigns.some((c) => c.id === campaignId);
  const hasPost = snapshot1.saasSocialPosts.some((p) => p.id === postId);

  console.log("[SOCIALFLOW_VALIDATE] After first creation", {
    campaigns: snapshot1.saasSocialCampaigns.length,
    posts: snapshot1.saasSocialPosts.length,
    hasCampaign,
    hasPost,
  });

  // 6. Simular reload: limpiar store y volver a acceder al estado (recarga desde snapshot)
  console.log("[SOCIALFLOW_VALIDATE] Simulating reload by resetting demo tenant state");
  __resetDemoTenantStateForDev(tenantId);
  const snapshotReload = exportDemoTenantState(tenantId);

  const hasCampaignReload = snapshotReload.saasSocialCampaigns.some((c) => c.id === campaignId);
  const hasPostReload = snapshotReload.saasSocialPosts.some((p) => p.id === postId);

  console.log("[SOCIALFLOW_VALIDATE] After simulated reload", {
    campaigns: snapshotReload.saasSocialCampaigns.length,
    posts: snapshotReload.saasSocialPosts.length,
    hasCampaignReload,
    hasPostReload,
  });

  // 7. Crear post con scheduledAt en el pasado para que el scheduler lo procese
  console.log("[SOCIALFLOW_VALIDATE] Creating scheduled post in the past for scheduler test");
  const scheduledPost = upsertDemoSaasSocialPost(tenantId, {
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
  if (!scheduledPostId) {
    console.error("[SOCIALFLOW_VALIDATE] ERROR: Scheduled post has no id");
    process.exit(1);
  }

  console.log("[SOCIALFLOW_VALIDATE] Scheduled post created", {
    scheduledPostId,
    scheduled_at: scheduledPost.scheduled_at,
    status: scheduledPost.status,
  });

  // 8. Ejecutar scheduler demo en el mismo proceso
  console.log("[SOCIALFLOW_VALIDATE] Running Social scheduler simulation");
  await runSocialSchedulerSimulation(ctx);

  // 9. Comprobar que el post pasa a POSTED/PUBLISHED y que el cambio persiste
  console.log("[SOCIALFLOW_VALIDATE] Exporting tenant state after scheduler");
  const snapshotAfterScheduler = exportDemoTenantState(tenantId);
  const scheduledPostAfter = snapshotAfterScheduler.saasSocialPosts.find(
    (p) => p.id === scheduledPostId,
  );

  const schedulerOk =
    !!scheduledPostAfter &&
    (scheduledPostAfter.status === "POSTED" || scheduledPostAfter.status === "PUBLISHED") &&
    scheduledPostAfter.posted_at !== null;

  console.log("[SOCIALFLOW_VALIDATE] After scheduler", {
    postId: scheduledPostId,
    status: scheduledPostAfter?.status,
    postedAt: scheduledPostAfter?.posted_at,
    schedulerOk,
  });

  if (!hasCampaign || !hasPost || !hasCampaignReload || !hasPostReload || !schedulerOk) {
    console.error("[SOCIALFLOW_VALIDATE] Validation failed", {
      hasCampaign,
      hasPost,
      hasCampaignReload,
      hasPostReload,
      schedulerOk,
    });
    process.exit(1);
  }

  console.log(
    "[SOCIALFLOW_VALIDATE] SUCCESS: snapshot contains campaign/post before and after reload and scheduler changes are persisted",
  );
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
