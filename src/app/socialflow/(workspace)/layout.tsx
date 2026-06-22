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
        <aside className="border-b border-slate-200 bg-white lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
          <div className="space-y-8 p-6">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">SocialFlow</div>
              <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Isolated product runtime</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                This workspace is served from the SocialFlow product boundary and only uses canonical
                `/socialflow/*` and `/api/socialflow/*` routes.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.20)]">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-200">Current workspace</div>
              <div className="mt-3 text-lg font-black">{session.name ?? "SocialFlow workspace"}</div>
              <div className="mt-2 text-sm text-slate-300">{session.email}</div>
            </div>

            <nav className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-2xl border border-transparent px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950"
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
