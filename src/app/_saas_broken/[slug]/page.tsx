import { redirect, notFound } from "next/navigation";
import SaasDetailClient from "../[id]/SaasDetailClient";
import { getSaasIdBySlug, getSlugBySaasId } from "@/lib/os/registry";

type PageProps = {
    params: Promise<{ slug: string }>;
};

function isUuid(str: string) {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // Also support the 'saas-drako-core' non-standard IDs we just seeded?
    // Actually those are just strings.
    return regex.test(str);
}

export default async function Page({ params }: PageProps) {
    const { slug } = await params;

    // 1. Try to resolve as Slug
    const saasId = await getSaasIdBySlug(slug);

    if (saasId) {
        // Found slug -> Render Client
        return <SaasDetailClient saasId={saasId} />;
    }

    // 2. Not found as Slug. Is it a legacy ID?
    // We check if we can resolve it as an ID to a Slug.
    // Note: 'saas-drako-core' is not a UUID but it IS an ID. 
    // getSlugBySaasId query: SELECT slug FROM saas_instances WHERE id = ?
    const resolvedSlug = await getSlugBySaasId(slug);

    if (resolvedSlug) {
        // It WAS an ID, and we found the slug. Redirect to the clean URL.
        return redirect(`/saas/${resolvedSlug}`);
    }

    // 3. Not found as Slug or ID -> 404
    return notFound();
}
