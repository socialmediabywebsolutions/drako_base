import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";

export const metadata: Metadata = {
  title: "SocialFlow Workspace",
  description: "Canonical authenticated workspace for SocialFlow operators",
  robots: {
    index: false,
    follow: false,
  },
};

const navItems = [
  { href: "/socialflow", label: "Workspace" },
  { href: "/socialflow/conversations", label: "Conversations" },
  { href: "/socialflow/leads", label: "Leads" },
  { href: "/socialflow/plan", label: "Plan editorial" },
  { href: "/socialflow/knowledge", label: "Knowledge Base" },
  { href: "/socialflow/profile", label: "Profile" },
  { href: "/socialflow/settings/account", label: "Account" },
  { href: "/socialflow/settings/accounts", label: "Accounts" },
  { href: "/socialflow/settings/team", label: "Team" },
  { href: "/socialflow/settings/billing", label: "Billing" },
  { href: "/socialflow/settings/ownership", label: "Ownership" },
];

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
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col lg:flex-row">
        <aside className="border-b border-slate-200 bg-white lg:min-h-screen lg:w-64 lg:border-b-0 lg:border-r">
          <div className="flex flex-col gap-6 p-5">
            {/* Brand */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-600">SocialFlow</span>
            </div>

            {/* User card */}
            <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white">
              <p className="truncate text-sm font-semibold leading-tight">{session.name ?? session.email}</p>
              <p className="truncate text-xs text-slate-400">{session.email}</p>
            </div>

            {/* Navigation */}
            <nav className="flex flex-col gap-0.5">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
