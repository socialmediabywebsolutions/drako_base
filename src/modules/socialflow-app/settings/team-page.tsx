/**
 * @deprecated Legacy module - moved to src/app/socialflow/(workspace)/settings/team/page.tsx
 * This file is kept for backward compatibility only.
 */
import Card from "@/components/ui/card";
import { listAuthsUsersByTenant } from "@/lib/auths/repositories";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { redirect } from "next/navigation";

export default async function SocialFlowTeamSettingsPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const members = await listAuthsUsersByTenant({
    context: "socialflow",
    tenantId: session.tenantId,
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">SocialFlow team</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Product users inside this workspace</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          This view reads SocialFlow users directly from the product auth boundary. Invite and role orchestration still need a dedicated product workflow before re-enabling write actions here.
        </p>
      </div>

      <Card title="Product auth roster" subtitle="Users registered in SocialFlow for this tenant" tone="glass">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Users</div>
            <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">{members.length}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Admins</div>
            <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">
              {members.filter((member) => member.role === "admin").length}
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Members</div>
            <div className="mt-3 text-2xl font-black tracking-tight text-slate-950">
              {members.filter((member) => member.role !== "admin").length}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Registered users" subtitle="Read-only until product-native invite flow lands">
        <div className="space-y-3">
          {members.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              No SocialFlow users found for this tenant yet.
            </div>
          ) : members.map((member) => (
            <div key={member.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-black tracking-tight text-slate-950">{member.name ?? member.email}</div>
                  <div className="mt-1 text-sm text-slate-500">{member.email}</div>
                </div>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${member.role === "admin" ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {member.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
