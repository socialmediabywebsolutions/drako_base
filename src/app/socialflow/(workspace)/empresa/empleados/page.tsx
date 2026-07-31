import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getEmployeesByTenant } from "@/lib/socialflow/employees/repository";
import EmpleadosClient from "./empleados-client";

const SAAS_ID = "socialflow";

export default async function EmpleadosPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }
  if (session.accountType !== "empresa") {
    redirect("/socialflow");
  }

  const employees = await getEmployeesByTenant(session.tenantId, SAAS_ID);

  return <EmpleadosClient initialEmployees={employees} />;
}
