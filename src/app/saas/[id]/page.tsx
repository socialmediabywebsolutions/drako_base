// src/app/saas/[id]/page.tsx
import SaasDetailClient from "./SaasDetailClient";


type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;

  const saasId = typeof id === "string" ? id : "";

  return <SaasDetailClient saasId={saasId} />;
}
