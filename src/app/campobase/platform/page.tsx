import PlatformOperatorControlSurface from "@/components/campobase/PlatformOperatorControlSurface";

export const dynamic = "force-dynamic";

export default async function CampoBasePlatformPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const tenantId = typeof resolved?.tenantId === "string" ? resolved.tenantId : undefined;
  const saasId = typeof resolved?.saasId === "string" ? resolved.saasId : undefined;

  return <PlatformOperatorControlSurface initialTenantId={tenantId} initialSaasId={saasId} />;
}
