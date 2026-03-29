import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CampoBasePlatformPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const query = new URLSearchParams();

  if (typeof resolved?.tenantId === "string") {
    query.set("tenantId", resolved.tenantId);
  }
  if (typeof resolved?.saasId === "string") {
    query.set("saasId", resolved.saasId);
  }

  redirect(query.size > 0 ? `/operator/platform?${query.toString()}` : "/operator/platform");
}
