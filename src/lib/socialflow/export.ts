import { queryOne } from "@/lib/db";
import { generateWipeoutPackage } from "@/lib/campamento-base/export-engine/wipeout";

const SOCIALFLOW_EXPORT_SLUGS = ["socialflow", "socialflows"];

export async function generateSocialFlowExportForTenant(tenantId: string) {
  const saas = await queryOne<{ id: string; slug: string }>(
    `SELECT id, slug
     FROM saas
     WHERE tenant_id = ? AND lower(slug) IN (?, ?)
     ORDER BY created_at DESC
     LIMIT 1`,
    tenantId,
    SOCIALFLOW_EXPORT_SLUGS[0],
    SOCIALFLOW_EXPORT_SLUGS[1],
  );

  if (!saas) {
    throw new Error("SocialFlow export target not found for tenant");
  }

  return generateWipeoutPackage(saas.id, tenantId);
}
