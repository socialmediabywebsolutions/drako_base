import { createGlobalSocialFlowExportCoreReadContract } from "@/lib/socialflow/contracts/export-core-read";
import { generateWipeoutPackage } from "@/lib/export/wipeout-package";

export async function generateSocialFlowExportForTenant(tenantId: string) {
  const coreReadContract = createGlobalSocialFlowExportCoreReadContract();
  const saas = await coreReadContract.findSocialFlowExportSaasSeed(tenantId);

  if (!saas) {
    throw new Error("SocialFlow export target not found for tenant");
  }

  return generateWipeoutPackage(saas.id, tenantId);
}
