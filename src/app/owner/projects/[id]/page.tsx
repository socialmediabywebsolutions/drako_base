import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OwnerProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolved = await params;
  redirect(`/operator/projects/${resolved.id}`);
}
