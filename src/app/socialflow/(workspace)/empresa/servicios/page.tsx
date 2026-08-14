import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getServicesByTenant } from "@/lib/socialflow/services/repository";
import ServiciosClient from "./servicios-client";

const SAAS_ID = "socialflow";

export default async function ServiciosPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }
  if (session.accountType !== "empresa") {
    redirect("/socialflow");
  }

  const services = await getServicesByTenant(session.tenantId, SAAS_ID);

  return <ServiciosClient initialServices={services} />;
}
