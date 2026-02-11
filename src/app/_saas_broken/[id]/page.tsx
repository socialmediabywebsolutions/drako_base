import { redirect, notFound } from "next/navigation";
import SaasDetailClient from "./SaasDetailClient";
import { getSaasIdBySlug, getSlugBySaasId } from "@/lib/os/registry";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function isUuid(str: string) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(str);
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const identifier = typeof id === "string" ? id : "";

  // 1. Try to resolve as Slug
  const saasIdFromSlug = await getSaasIdBySlug(identifier);

  if (saasIdFromSlug) {
    // Found slug -> Render Client with the resolved ID
    return <SaasDetailClient saasId={saasIdFromSlug} />;
  }

  // 2. Not found as Slug. Is it an ID?
  // We check if we can resolve it as an ID to a Slug.
  // Note: 'saas-drako-core' is not a UUID but it IS an ID used in seeds.
  const resolvedSlug = await getSlugBySaasId(identifier);

  if (resolvedSlug) {
    // It WAS an ID, and we found the slug. Redirect to the clean URL.
    return redirect(`/saas/${resolvedSlug}`);
  }

  // 3. If it looks like a valid ID but has no slug, we can render it directly
  // (Fallback for instances without slugs or custom IDs)
  if (isUuid(identifier) || identifier.startsWith('saas-')) {
    return <SaasDetailClient saasId={identifier} />;
  }

  // 4. Not found as Slug or ID -> 404
  return notFound();
}
