// src/app/saas/[id]/page.tsx
export const runtime = "edge";

import SaasDetailClient from "./SaasDetailClient";

type PageProps = {
  params: { id: string };
};

export default function SaasDetailPage({ params }: PageProps) {
  return <SaasDetailClient saasId={params.id} />;
}
