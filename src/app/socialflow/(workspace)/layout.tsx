import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import SidebarNav from "./_components/sidebar-nav";

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
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
