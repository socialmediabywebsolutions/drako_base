// Isolated product runtime — no direct DB access, no legacy shells.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";
import SidebarNav from "./_components/sidebar-nav";
import TrialBanner from "./_components/trial-banner";
import TrialPaywall from "./_components/trial-paywall";

export const metadata: Metadata = {
  title: "SocialFlow",
  description: "Sistema operativo de marketing con IA",
  robots: {
    index: false,
    follow: false,
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

  // Real paid subscription (has actual Stripe customer ID, status active/trialing)
  const hasPaidAccess =
    isPrivilegedRole ||
    ((sub.status === "active" || sub.status === "trialing") && Boolean(sub.stripeCustomerId));

  // Trial window
  const trialEndsAt = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const isTrialActive = !isPrivilegedRole && sub.status === "trial" && trialEndsAt !== null && trialEndsAt > new Date();
  const isTrialExpired = !isPrivilegedRole && sub.status === "trial" && trialEndsAt !== null && trialEndsAt <= new Date();

  // Days left (shown in banner, max precision = 1 day)
  const trialDaysLeft = isTrialActive && trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  // Paywall: only when trial has actually expired and no paid access
  const showPaywall = !hasPaidAccess && isTrialExpired;

  return (
    <div className="min-h-screen bg-[#030312] text-white">
      {/* Subtle gradient orbs — fixed so they don't scroll */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-5%] top-[-5%] h-[400px] w-[400px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute right-[-5%] bottom-[-5%] h-[350px] w-[350px] rounded-full bg-fuchsia-600/8 blur-[100px]" />
      </div>

      <div className="relative flex min-h-screen">
        {/* Sidebar — hidden on mobile, shown on lg */}
        <div className="hidden lg:flex">
          <SidebarNav session={{ name: session.name ?? null, email: session.email }} />
        </div>

        {/* Main content */}
        <main className="min-w-0 flex-1 px-5 py-7 lg:px-10 lg:py-8">
          {trialDaysLeft !== null && !showPaywall && (
            <TrialBanner daysLeft={trialDaysLeft} />
          )}
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Floating AI button */}
      <div className="group fixed bottom-6 right-6 z-50">
        <span className="absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
          Estratega IA
        </span>
        <Link
          href="/socialflow/ai"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/30 hover:brightness-110 transition cursor-pointer"
        >
          <span className="text-xl text-white">✦</span>
        </Link>
      </div>

      {/* Paywall overlay — covers entire workspace when trial expires */}
      {showPaywall && <TrialPaywall />}
    </div>
  );
}
