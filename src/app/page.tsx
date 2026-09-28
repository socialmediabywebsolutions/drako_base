import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { HostMode, resolveHostMode } from "@/lib/hosts";
import DrakoLanding from "@/components/marketing/DrakoLanding";

const isHostMode = (value: string | null): value is HostMode =>
  value === "CAMPAMENTO_BASE" || value === "PREVIEW" || value === "PUBLIC_SAAS";

export const metadata = {
  title: "DRAKO Systems — La IA que domina tu negocio digital",
  description:
    "Holding de inteligencia artificial especializada. 26+ agentes autónomos, 3 SaaS activos, automatización 24/7 para negocios digitales.",
};

export default async function Home() {
  const headersList = await headers();
  const host = headersList.get("x-drako-effective-host") ?? headersList.get("host") ?? "";
  const headerMode = headersList.get("x-drako-host-mode");
  const mode = isHostMode(headerMode) ? headerMode : resolveHostMode(host);

  if (mode === "CAMPAMENTO_BASE") redirect("/admin");
  if (mode === "PREVIEW") redirect("/preview");
  if (host.includes("socialflow")) redirect("/socialflow");

  return <DrakoLanding />;
}
