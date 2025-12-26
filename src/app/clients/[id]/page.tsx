import type { Metadata } from "next";
import ClientDetailClient from "./ClientDetailClient";

export const runtime = "edge";

export const metadata: Metadata = {
  title: "Cliente",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailPage({ params }: PageProps) {
  const resolved = await params;
  return <ClientDetailClient clientId={resolved.id} />;
}
