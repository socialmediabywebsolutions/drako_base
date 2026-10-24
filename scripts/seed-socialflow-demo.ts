import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  createDemoSaasTask,
  exportDemoTenantState,
  replaceDemoTenantState,
  upsertDemoOwner,
  upsertDemoSaas,
  upsertDemoSaasDomain,
  upsertDemoSaasSocialAccount,
  upsertDemoSaasSocialCampaign,
  upsertDemoSaasSocialMetric,
  upsertDemoSaasSocialPost,
} from "@/lib/admin/demo-data";

const OUTPUT_ARG = process.argv.find((arg) => arg.startsWith("--out="));
const OUTPUT_PATH = resolve(process.cwd(), OUTPUT_ARG ? OUTPUT_ARG.slice("--out=".length) : ".demo/socialflow-demo.json");
const WORKING_TENANT_ID = "socialflow_seed_workspace";
const TENANT_IDS = ["demo-tenant", "demo_tenant"] as const;
const SAAS_ID = "saas_demo_socialflow";
const SAAS_SLUG = "socialflow";
const NOW = new Date("2026-03-12T10:00:00.000Z");

function isoOffsetDays(days: number, hour: number) {
  const next = new Date(NOW);
  next.setUTCDate(next.getUTCDate() + days);
  next.setUTCHours(hour, 0, 0, 0);
  return next.toISOString();
}

async function main() {
  upsertDemoOwner(WORKING_TENANT_ID, {
    name: "Demo Workspace",
    email: "operators@socialflow.demo",
    city: "Madrid",
    country: "Spain",
  });

  upsertDemoSaas(WORKING_TENANT_ID, {
    id: SAAS_ID,
    name: "SocialFlow",
    slug: SAAS_SLUG,
    domain: "app.socialflow.localhost",
    public_domain: "app.socialflow.localhost",
    public_subdomain: SAAS_SLUG,
    status: "active",
    domain_status: "active",
  });

  upsertDemoSaasDomain(WORKING_TENANT_ID, {
    id: "saas_domain_socialflow_primary",
    saas_id: SAAS_ID,
    domain: "app.socialflow.localhost",
    is_primary: 1,
    status: "active",
    last_checked_at: NOW.toISOString(),
  });

  [
    {
      id: "social_account_instagram_demo",
      provider: "INSTAGRAM",
      handle: "@socialflowdemo",
      display_name: "SocialFlow Demo",
      primary: 1,
      token_status: "healthy",
    },
    {
      id: "social_account_linkedin_demo",
      provider: "LINKEDIN",
      handle: "socialflow-demo",
      display_name: "SocialFlow on LinkedIn",
      primary: 0,
      token_status: "refresh_due_soon",
    },
    {
      id: "social_account_x_demo",
      provider: "TWITTER_X",
      handle: "@socialflow_ops",
      display_name: "SocialFlow Ops",
      primary: 0,
      token_status: "healthy",
    },
  ].forEach((account) => {
    upsertDemoSaasSocialAccount(WORKING_TENANT_ID, {
      id: account.id,
      saas_id: SAAS_ID,
      provider: account.provider,
      handle: account.handle,
      display_name: account.display_name,
      status: "CONNECTED_DEMO",
      auth_meta: JSON.stringify({
        mode: "demo",
        connected: true,
        token_status: account.token_status,
      }),
      primary: account.primary,
    });
  });

  const campaigns = [
    {
      id: "social_campaign_launch",
      name: "Launch Campaign",
      objective: "Drive awareness for the first public SocialFlow demo",
      target_segment: "founders and solo marketers",
      budget_estimate: 450,
    },
    {
      id: "social_campaign_weekly_content",
      name: "Weekly Content",
      objective: "Keep the editorial calendar active with repeatable weekly posts",
      target_segment: "small marketing teams",
      budget_estimate: 280,
    },
    {
      id: "social_campaign_lead_magnet",
      name: "Lead Magnet Series",
      objective: "Convert demo traffic into qualified operator calls",
      target_segment: "agency operators",
      budget_estimate: 600,
    },
  ] as const;

  campaigns.forEach((campaign, index) => {
    upsertDemoSaasSocialCampaign(WORKING_TENANT_ID, {
      id: campaign.id,
      saas_id: SAAS_ID,
      name: campaign.name,
      objective: campaign.objective,
      status: "ACTIVE",
      target_segment: campaign.target_segment,
      start_date: isoOffsetDays(-(7 + index), 9),
      end_date: isoOffsetDays(21 + index, 18),
      budget_estimate: campaign.budget_estimate,
      notes: "Demo campaign seeded for local SocialFlow walkthroughs.",
    });
  });

  const scheduledPosts = [
    ["launch-reel", "Launch reel", "SocialFlow keeps the first demo launch organized across channels.", "INSTAGRAM", "REEL", 1, 10, campaigns[0].id],
    ["launch-thread", "Launch thread", "A simple operator view is enough to keep publishing moving.", "TWITTER_X", "FEED", 1, 14, campaigns[0].id],
    ["launch-linkedin", "Launch on LinkedIn", "Show one workspace for campaign planning, scheduling, and reporting.", "LINKEDIN", "FEED", 2, 11, campaigns[0].id],
    ["weekly-monday", "Weekly Monday post", "Start the week with one scheduled asset and a visible next action.", "INSTAGRAM", "CAROUSEL", 3, 9, campaigns[1].id],
    ["weekly-midweek", "Midweek editorial pulse", "SocialFlow keeps recurring campaigns visible without enterprise overhead.", "LINKEDIN", "FEED", 4, 12, campaigns[1].id],
    ["weekly-friday", "Friday wrap-up", "Review the calendar before the week closes and queue the next posts.", "TWITTER_X", "FEED", 5, 16, campaigns[1].id],
    ["lead-magnet-1", "Lead magnet teaser", "Turn a guide or checklist into a cross-channel campaign with one shared queue.", "LINKEDIN", "FEED", 6, 10, campaigns[2].id],
    ["lead-magnet-2", "Lead magnet reminder", "Use one campaign to coordinate organic posts and operator follow-up.", "INSTAGRAM", "STORY", 6, 18, campaigns[2].id],
    ["lead-magnet-3", "Operator checklist drop", "A clear publish loop reduces missed steps in early customer operations.", "TWITTER_X", "FEED", 7, 9, campaigns[2].id],
    ["lead-magnet-4", "Demo booking push", "Demo connections and placeholder analytics stay explicit inside the product.", "LINKEDIN", "FEED", 7, 13, campaigns[2].id],
  ] as const;

  scheduledPosts.forEach(([id, title, body, provider, contentType, dayOffset, hour, campaignId], index) => {
    upsertDemoSaasSocialPost(WORKING_TENANT_ID, {
      id: `social_post_${id}`,
      saas_id: SAAS_ID,
      campaign_id: campaignId,
      provider,
      content_type: contentType,
      title,
      body,
      image_hint: "demo creative",
      status: "SCHEDULED",
      scheduled_at: isoOffsetDays(dayOffset, hour),
      posted_at: null,
      external_post_id: null,
      metadata: JSON.stringify({
        priority: index < 3 ? "high" : "normal",
        demo_seed: true,
      }),
    });
  });

  const publishedPosts = [
    ["published-recap", "Launch recap", "Recap the first launch week and highlight what the team learned.", "INSTAGRAM", campaigns[0].id, -2, 15, { impressions: 5400, likes: 320, comments: 22, shares: 18, clicks: 74, reach: 4700, growth_rate: 0.064 }],
    ["published-proof", "Workflow proof", "Show the campaign-to-calendar-to-analytics loop in one minute.", "LINKEDIN", campaigns[1].id, -5, 11, { impressions: 4600, likes: 190, comments: 16, shares: 21, clicks: 68, reach: 3900, growth_rate: 0.048 }],
    ["published-checklist", "Operator checklist", "A simple operating checklist beats tool sprawl for early teams.", "TWITTER_X", campaigns[2].id, -9, 13, { impressions: 3800, likes: 140, comments: 12, shares: 26, clicks: 59, reach: 3200, growth_rate: 0.041 }],
    ["published-demo", "Demo CTA", "Invite prospects to a guided SocialFlow walkthrough on the shared runtime.", "LINKEDIN", campaigns[0].id, -14, 10, { impressions: 5100, likes: 230, comments: 17, shares: 19, clicks: 81, reach: 4300, growth_rate: 0.057 }],
  ] as const;

  publishedPosts.forEach(([id, title, body, provider, campaignId, dayOffset, hour, metrics], index) => {
    const postId = `social_post_${id}`;
    const postedAt = isoOffsetDays(dayOffset, hour);
    upsertDemoSaasSocialPost(WORKING_TENANT_ID, {
      id: postId,
      saas_id: SAAS_ID,
      campaign_id: campaignId,
      provider,
      content_type: "FEED",
      title,
      body,
      image_hint: "published demo creative",
      status: "PUBLISHED",
      scheduled_at: postedAt,
      posted_at: postedAt,
      external_post_id: `demo_external_${index + 1}`,
      metadata: JSON.stringify({
        demo_seed: true,
        published: true,
      }),
    });
    upsertDemoSaasSocialMetric(WORKING_TENANT_ID, {
      id: `social_metric_${id}`,
      saas_id: SAAS_ID,
      post_id: postId,
      provider,
      impressions: metrics.impressions,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
      clicks: metrics.clicks,
      leads_generated: Math.max(2, Math.round(metrics.clicks / 12)),
      captured_at: postedAt,
      metadata: JSON.stringify({
        engagement: metrics.likes + metrics.comments + metrics.shares + metrics.clicks,
        reach: metrics.reach,
        growth_rate: metrics.growth_rate,
        source: "socialflow_demo_seed",
      }),
    });
  });

  createDemoSaasTask(WORKING_TENANT_ID, {
    id: "social_task_auto_publish_demo",
    saas_id: SAAS_ID,
    title: "Auto-publish when scheduled",
    description: "Publish scheduled SocialFlow posts through the demo loop when they become due.",
    category: "SOCIAL",
    source: "SYSTEM",
    status: "OPEN",
    severity: "SUGGESTION",
    assignee_employee_id: null,
    due_date: null,
    metadata: JSON.stringify({
      type: "automation_rule",
      trigger: "post.scheduled",
      action: "publish.placeholder",
      scope: { providers: ["INSTAGRAM", "LINKEDIN", "TWITTER_X"] },
    }),
  });

  const snapshot = exportDemoTenantState(WORKING_TENANT_ID);
  const payload = {
    generatedAt: NOW.toISOString(),
    tenants: Object.fromEntries(
      TENANT_IDS.map((tenantId) => {
        replaceDemoTenantState(tenantId, snapshot);
        return [tenantId, exportDemoTenantState(tenantId)];
      }),
    ),
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`SocialFlow demo seed written to ${OUTPUT_PATH}`);
  console.log(`Seeded tenants: ${TENANT_IDS.join(", ")}`);
  console.log("Seeded accounts: 3");
  console.log("Seeded campaigns: 3");
  console.log("Seeded scheduled posts: 10");
  console.log("Seeded published posts with metrics: 4");
}

main().catch((error) => {
  console.error("SOCIALFLOW_DEMO_SEED_FAILED", error);
  process.exit(1);
});
