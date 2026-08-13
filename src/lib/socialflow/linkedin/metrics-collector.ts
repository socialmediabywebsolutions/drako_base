import { env } from "@/lib/cf";
import { decryptToken } from "@/lib/socialflow/token-encryption";
import { resolveSocialContext, upsertSaasSocialMetrics } from "@/lib/socialflow/repository";
import { fetchLinkedInOrganizationShareStatistics, LinkedInIntegrationError } from "@/lib/socialflow/linkedin/core";

// Métricas de LinkedIn — gateadas por completo detrás de linkedin_cm_enabled
// (columna en saas_social_accounts, migración 0217). organizationalEntityShareStatistics
// exige el permiso rw_organization_admin (Community Management API, app
// "Socialcors Community Management", client_id 78kxkuoq09u78p, en review a
// fecha 2026-08-13) — no existe ningún nivel de métricas disponible con
// w_member_social ni con w_organization_social solo, ni para posts de perfil
// personal (LinkedIn no tiene un endpoint de analíticas para eso en absoluto).
// Cuando linkedin_cm_enabled=false (todas las cuentas hoy) esta función no
// hace ninguna llamada HTTP a LinkedIn — se limita a contar la cuenta como
// "saltada". Activar cuenta por cuenta cuando LinkedIn apruebe y se confirme
// que la aprobación incluye rw_organization_admin.

type LinkedInMetricsAccountRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  auth_meta: string | null;
  linkedin_cm_enabled: number | null;
};

type LinkedInMetricsPostRow = {
  id: string;
  external_post_id: string | null;
};

export type LinkedInMetricsResult = { processed: number; errors: number; skipped: number };

export async function processLinkedInMetrics(): Promise<LinkedInMetricsResult> {
  const bindings = env();
  const socialDb = bindings?.SOCIAL_DB;
  if (!socialDb) throw new Error("SOCIAL_DB not configured");

  const { results: accounts } = await socialDb
    .prepare(
      `SELECT id, tenant_id, saas_id, auth_meta, linkedin_cm_enabled
       FROM saas_social_accounts
       WHERE provider = 'LINKEDIN' AND status = 'CONNECTED_REAL'
       LIMIT 50`,
    )
    .all<LinkedInMetricsAccountRow>();

  if (!accounts?.length) {
    return { processed: 0, errors: 0, skipped: 0 };
  }

  let processed = 0;
  let errors = 0;
  let skipped = 0;

  for (const account of accounts) {
    if (account.linkedin_cm_enabled !== 1) {
      skipped++;
      continue;
    }

    try {
      const authMeta = account.auth_meta ? (JSON.parse(account.auth_meta) as Record<string, unknown>) : null;
      const encryptedToken = typeof authMeta?.accessToken === "string" ? authMeta.accessToken : null;
      const organizationUrn = typeof authMeta?.organizationUrn === "string" ? authMeta.organizationUrn : null;

      if (!encryptedToken || !organizationUrn) {
        console.warn(`[LinkedInMetricsCron] Account ${account.id}: missing token or organizationUrn despite linkedin_cm_enabled`);
        errors++;
        continue;
      }

      const accessToken = await decryptToken(encryptedToken);
      if (!accessToken) {
        console.warn(`[LinkedInMetricsCron] Account ${account.id}: decryption returned null`);
        errors++;
        continue;
      }

      const ctx = await resolveSocialContext({ tenantId: account.tenant_id, saasId: account.saas_id });

      const { results: posts } = await socialDb
        .prepare(
          `SELECT id, external_post_id FROM saas_social_posts
           WHERE tenant_id = ? AND saas_id = ? AND provider = 'LINKEDIN'
             AND status IN ('POSTED', 'PUBLISHED') AND external_post_id IS NOT NULL
           ORDER BY datetime(posted_at) DESC LIMIT 10`,
        )
        .bind(account.tenant_id, account.saas_id)
        .all<LinkedInMetricsPostRow>();

      for (const post of posts ?? []) {
        if (!post.external_post_id) continue;
        try {
          const stats = await fetchLinkedInOrganizationShareStatistics(accessToken, organizationUrn, post.external_post_id);
          await upsertSaasSocialMetrics(ctx, {
            postId: post.id,
            provider: "LINKEDIN",
            impressions: stats?.impressionCount ?? 0,
            likes: stats?.likeCount ?? 0,
            comments: stats?.commentCount ?? 0,
            shares: stats?.shareCount ?? 0,
            clicks: stats?.clickCount ?? 0,
            capturedAt: new Date().toISOString(),
            metadata: {
              type: "organization_share",
              organizationUrn,
              engagement: stats?.engagement ?? 0,
            },
          });
          processed++;
        } catch (postError) {
          const message =
            postError instanceof LinkedInIntegrationError
              ? `${postError.code}: ${postError.message}`
              : postError instanceof Error
                ? postError.message
                : String(postError);
          console.warn(`[LinkedInMetricsCron] Post ${post.id} error:`, message);
          errors++;
        }
      }
    } catch (accountError) {
      console.warn(
        `[LinkedInMetricsCron] Account ${account.id} error:`,
        accountError instanceof Error ? accountError.message : String(accountError),
      );
      errors++;
    }
  }

  return { processed, errors, skipped };
}
