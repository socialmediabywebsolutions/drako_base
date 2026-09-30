import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import DrakoLanding from "@/components/marketing/DrakoLanding";
import { getLocaleOrRedirect } from "./locale-guard";

const isHostMode = (value: string | null): value is HostMode =>
  value === "CAMPAMENTO_BASE" || value === "PREVIEW" || value === "PUBLIC_SAAS";

export default async function LocaleHomePage({ params }: { params: Promise<{ locale?: string }> }) {
  const resolvedParams = await params;
  getLocaleOrRedirect(resolvedParams?.locale, "/");
  const headersList = await headers();
  const host = headersList.get("x-drako-effective-host") ?? headersList.get("host") ?? "";
  const headerMode = headersList.get("x-drako-host-mode");
  const mode = isHostMode(headerMode) ? headerMode : resolveHostMode(host);
  if (mode === "CAMPAMENTO_BASE") redirect("/admin");
  if (mode === "PREVIEW") redirect("/preview");
  if (host.includes("socialflow")) redirect("/socialflow");
  return <DrakoLanding />;
}
