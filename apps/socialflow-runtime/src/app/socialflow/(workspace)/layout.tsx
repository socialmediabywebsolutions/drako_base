import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentSocialFlowSession } from "../../../lib/auth/session";

export const metadata: Metadata = {
  title: "Socialcors Workspace",
  description: "Canonical authenticated workspace for Socialcors operators",
  robots: {
    index: false,
    follow: false,
  },
};

const navItems = [
  { href: "/socialflow", label: "Workspace" },
  { href: "/socialflow/profile", label: "Profile" },
  { href: "/socialflow/ai", label: "AI" },
  { href: "/socialflow/settings/account", label: "Account" },
  { href: "/socialflow/settings/team", label: "Team" },
  { href: "/socialflow/settings/billing", label: "Billing" },
  { href: "/socialflow/settings/ownership", label: "Ownership" },
];

export default async function SocialFlowWorkspaceLayout({
  children,
}: {
  children: ReactNode;
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
              <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">Runtime canary workspace</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                This inactive app reuses the canonical SocialFlow auth, settings and `/api/socialflow/*`
                runtime while staying outside the monolith root graph.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.20)]">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-200">Current workspace</div>
              <div className="mt-3 text-lg font-black">{session.name ?? "SocialFlow workspace"}</div>
              <div className="mt-2 text-sm text-slate-300">{session.email}</div>
              <div className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-400">
                tenant {session.tenantId}
              </div>
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
