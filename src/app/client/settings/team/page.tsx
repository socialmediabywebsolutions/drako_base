import { redirect } from "next/navigation";
import { headers } from "next/headers";
import TeamSettings from "@/components/settings/team-settings";
import { getCurrentTenant } from "@/lib/auth/server";
import { listTenantInvites, listTenantMembers } from "@/lib/auth/campamento-core";

export default async function TeamSettingsPage() {
  const current = await getCurrentTenant();
  if (!current) {
    redirect("/auth/login");
  }

  const members = await listTenantMembers(current.tenant.id);
  const invites = await listTenantInvites(current.tenant.id);
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "localhost:3000";
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const inviteBaseUrl = `${protocol}://${host}`;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">Workspace team</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Members, roles and invited teammates</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Keep the workspace team aligned, protect the last OWNER, and manage invitation links from one canonical place.
        </p>
      </div>
      <TeamSettings
        workspaceName={current.tenant.name}
        members={members}
        invites={invites.map((invite) => ({
          id: invite.id,
          email: invite.email,
          role: invite.role,
          status: invite.status,
          expiresAt: invite.expiresAt,
          token: invite.token,
        }))}
        inviteBaseUrl={inviteBaseUrl}
      />
    </div>
  );
}
