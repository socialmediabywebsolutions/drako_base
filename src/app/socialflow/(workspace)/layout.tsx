// Isolated product runtime — no direct DB access, no legacy shells.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";
import { resolveSocialFlowPlanCode } from "@/lib/socialflow/billing/plans";
import { listSaasSocialAccounts, resolveSocialContext } from "@/lib/socialflow/repository";
import { getWeeklyPublishStatus } from "@/lib/socialflow/billing/enforce";
import SidebarNav from "./_components/sidebar-nav";
import TrialBanner from "./_components/trial-banner";
import TrialPaywall from "./_components/trial-paywall";
import QuotaBanner from "./_components/quota-banner";

export const metadata: Metadata = {
  title: "Socialcors",
  description: "Sistema operativo de marketing con IA",
  robots: {
    index: false,
    follow: false,
  },
  // Favicon/perfil — R2 como fuente de verdad única, mismo bucket que el logo de
  // cabecera y el de los emails (WeeklyBriefingAgent.ts).
  icons: {
    icon: "https://pub-3e782268d66e465bbe7c7fa767074ee2.r2.dev/assets/logo-perfil.png",
    apple: "https://pub-3e782268d66e465bbe7c7fa767074ee2.r2.dev/assets/logo-perfil.png",
  },
};

export default async function SocialFlowWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  // Owners and admins bypass all trial restrictions
  const isPrivilegedRole = session.role === "owner" || session.role === "admin";

  const snapshot = await getCanonicalBillingSnapshot({ tenantId: session.tenantId, saasSlug: "socialflow" });
  const sub = snapshot.subscription;

  const weeklyPublishStatus = await getWeeklyPublishStatus(session.tenantId, session.role).catch(() => null);

  const socialCtx = await resolveSocialContext({ tenantId: session.tenantId, saasId: "socialflow" });
  const socialAccounts = await listSaasSocialAccounts(socialCtx);
  const connectedProviders = socialAccounts
    .filter((account) => account.status === "CONNECTED_REAL" || account.status === "PENDING_REAL")
    .map((account) => account.provider);

  // Real paid subscription (has actual Stripe customer ID, status active/trialing)
  const hasPaidAccess =
    isPrivilegedRole ||
    ((sub.status === "active" || sub.status === "trialing") && Boolean(sub.stripeCustomerId));

  // Trial window
  const trialEndsAt = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const isTrialActive = !isPrivilegedRole && sub.status === "trial" && trialEndsAt !== null && trialEndsAt > new Date();
  const isTrialExpired = !isPrivilegedRole && sub.status === "trial" && trialEndsAt !== null && trialEndsAt <= new Date();

  // Plan real ya asignado (distinto de free) — si el tenant ya eligió plan, el banner
  // de "Elegir plan" deja de tener sentido aunque el status siga en "trial".
  const assignedPlanCode = resolveSocialFlowPlanCode(
    { status: sub.status, planCode: sub.planCode },
    { isInternalAccount: snapshot.isInternalAccount, accountType: session.accountType },
  );
  const hasAssignedPlan = assignedPlanCode !== "free";

  // Days left (shown in banner, max precision = 1 day)
  const trialDaysLeft = isTrialActive && trialEndsAt && !hasAssignedPlan
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  // Paywall: only when trial has actually expired and no paid access
  const showPaywall = !hasPaidAccess && isTrialExpired;

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--sf-bg)", color: "var(--sf-text)" }}
    >
      <div className="relative flex min-h-screen">
        {/* Sidebar — hidden on mobile, shown on lg */}
        <div className="hidden lg:flex">
          <SidebarNav
            session={{ name: session.name ?? null, email: session.email, accountType: session.accountType }}
            connectedProviders={connectedProviders}
          />
        </div>

        {/* Main content */}
        <main className="min-w-0 flex-1 px-5 py-7 lg:px-10 lg:py-8">
          {trialDaysLeft !== null && !showPaywall && (
            <TrialBanner daysLeft={trialDaysLeft} />
          )}
          {weeklyPublishStatus && (
            <QuotaBanner
              isAtDailyCap={weeklyPublishStatus.instagramDaily.isAtCap}
              isOverWeeklyQuota={weeklyPublishStatus.instagram.isOverQuota}
              weeklyUsed={weeklyPublishStatus.instagram.used}
              weeklyLimit={weeklyPublishStatus.instagram.limit}
            />
          )}
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Paywall overlay — covers entire workspace when trial expires */}
      {showPaywall && <TrialPaywall accountType={session.accountType} />}
    </div>
  );
}
