import { redirect } from "next/navigation";
import { headers } from "next/headers";
import SocialFlowShell from "@/components/layouts/socialflow-shell";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { env } from "@/lib/cf";
import type { StrategicDossier } from "@/lib/orchestrator/types";

async function getDossier(tenantId: string): Promise<StrategicDossier | null> {
  const bindings = env();
  if (!bindings?.DRACO_DB) return null;

  try {
    const row = await bindings.DRACO_DB.prepare(
      `SELECT * FROM tenant_strategic_dossiers WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`,
    ).bind(tenantId).first<any>();

    if (!row) return null;

    return {
      ...row,
      form_data: JSON.parse(row.form_data as string),
      analysis_data: row.analysis_data ? JSON.parse(row.analysis_data as string) : undefined,
      plan_data: row.plan_data ? JSON.parse(row.plan_data as string) : undefined,
    };
  } catch {
    return null;
  }
}

export default async function SocialFlowWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const headerStore = await headers();
  const dossier = await getDossier(session.tenantId);

  return (
    <SocialFlowShell
      dossier={dossier || undefined}
      entryMode={headerStore.get("x-drako-client-entry-mode") ?? "product_operator"}
      workspaceKind={headerStore.get("x-drako-client-workspace-kind") ?? "owned_saas"}
      contentWidth="standard"
      workspaceSummary={{
        tenantName: session.name ?? "SocialFlow workspace",
        tenantSlug: "socialflow",
        plan: "STARTER",
        billingStatus: "isolated",
        onboardingProgress: 100,
        onboardingNextStep: null,
        currentUserRole: session.role === "admin" ? "ADMIN" : "MEMBER",
        connectedProducts: [],
      }}
    >
      {children}
    </SocialFlowShell>
  );
}
