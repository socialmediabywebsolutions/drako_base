import { redirect } from "next/navigation";
import SocialFlowShell from "@/components/layouts/socialflow-shell";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";

export default async function SocialFlowWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  return (
    <SocialFlowShell
      entryMode="isolated_product"
      workspaceKind="socialflow_workspace"
      contentWidth="standard"
      workspaceSummary={{
        tenantName: session.name ?? "Socialcors workspace",
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
