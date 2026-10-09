import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getLocal, getLocalPhotos } from "@/lib/socialflow/local/repository";
import LocalClient from "./local-client";

const SAAS_ID = "socialflow";

export default async function LocalPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }
  if (session.accountType !== "empresa") {
    redirect("/socialflow");
  }

  const [local, photos] = await Promise.all([
    getLocal(session.tenantId, SAAS_ID),
    getLocalPhotos(session.tenantId, SAAS_ID),
  ]);

  return <LocalClient initialLocal={local} initialPhotos={photos} />;
}
