"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Select from "@/components/ui/select";
import { Field, TextInput } from "@/components/ui/input";

type Role = "OWNER" | "ADMIN" | "MEMBER";

type TeamSettingsProps = {
  workspaceName: string;
  inviteBaseUrl: string;
  members: Array<{
    id: string;
    userId: string;
    email: string;
    role: Role;
    userName: string | null;
  }>;
  invites: Array<{
    id: string;
    email: string;
    role: Role;
    status: string;
    expiresAt: string;
    token: string;
  }>;
};

function rolePill(role: Role): string {
  if (role === "OWNER") return "bg-slate-950 text-white";
  if (role === "ADMIN") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-600";
}

export default function TeamSettings({ workspaceName, inviteBaseUrl, members, invites }: TeamSettingsProps) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("MEMBER");
  const [message, setMessage] = useState<string | null>(null);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const teamSummary = useMemo(() => ({
    owners: members.filter((member) => member.role === "OWNER").length,
    admins: members.filter((member) => member.role === "ADMIN").length,
    members: members.filter((member) => member.role === "MEMBER").length,
  }), [members]);

  const sendInvite = () => {
    startTransition(async () => {
      setMessage(null);
      setCreatedInviteUrl(null);
      const res = await fetch("/api/invites/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = (await res.json().catch(() => ({}))) as { code?: string; inviteUrl?: string };
      if (!res.ok) {
        setMessage(data.code ?? "Unable to send invite");
        return;
      }
      setInviteEmail("");
      setInviteRole("MEMBER");
      setCreatedInviteUrl(data.inviteUrl ?? null);
      setMessage("Invite created and ready to share.");
      router.refresh();
    });
  };

  const updateRole = (userId: string, role: Role) => {
    startTransition(async () => {
      setMessage(null);
      const res = await fetch("/api/tenants/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const data = (await res.json().catch(() => ({}))) as { code?: string };
      if (!res.ok) {
        setMessage(data.code ?? "Unable to update role");
        return;
      }
      setMessage("Member role updated.");
      router.refresh();
    });
  };

  async function copyInvite(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Invite link copied.");
    } catch {
      setMessage("Copy failed. Use the invite URL shown below.");
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Team overview" subtitle="Workspace access at a glance" tone="glass">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Workspace</div>
            <div className="mt-3 text-xl font-black tracking-tight text-slate-950">{workspaceName}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Owners</div>
            <div className="mt-3 text-xl font-black tracking-tight text-slate-950">{teamSummary.owners}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Admins</div>
            <div className="mt-3 text-xl font-black tracking-tight text-slate-950">{teamSummary.admins}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Pending invites</div>
            <div className="mt-3 text-xl font-black tracking-tight text-slate-950">{invites.filter((invite) => invite.status === "pending").length}</div>
          </div>
        </div>
      </Card>

      <Card title="Invite teammate" subtitle="Generate a secure workspace invite">
        <div className="grid gap-4 lg:grid-cols-[1.5fr,1fr,auto]">
          <Field label="Email">
            <TextInput
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="teammate@company.com"
            />
          </Field>
          <Field label="Role">
            <Select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as Role)}>
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </Field>
          <div className="flex items-end">
            <Button onClick={sendInvite} loading={isPending} disabled={!inviteEmail.trim()}>
              Invite teammate
            </Button>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Invitees join through the canonical Campamento Base auth flow and keep the workspace session model intact.
        </p>
        {createdInviteUrl ? (
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-sky-700">Invite link</div>
            <code className="mt-3 block break-all rounded-xl bg-white px-3 py-2 text-xs text-slate-700">{createdInviteUrl}</code>
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={() => copyInvite(createdInviteUrl)}>
                Copy invite link
              </Button>
            </div>
          </div>
        ) : null}
        {message ? <p className="mt-4 text-sm font-medium text-slate-600">{message}</p> : null}
      </Card>

      <Card title="Members" subtitle="Roles are enforced by the tenant workspace contract">
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1.6fr,1fr,auto] lg:items-center">
              <div>
                <div className="text-base font-black tracking-tight text-slate-950">{member.userName ?? member.email}</div>
                <div className="mt-1 text-sm text-slate-500">{member.email}</div>
              </div>
              <Select
                value={member.role}
                onChange={(event) => updateRole(member.userId, event.target.value as Role)}
                disabled={isPending}
              >
                <option value="OWNER">Owner</option>
                <option value="ADMIN">Admin</option>
                <option value="MEMBER">Member</option>
              </Select>
              <div className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] ${rolePill(member.role)}`}>
                {member.role}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Pending invites" subtitle="Visible, shareable and easy to audit">
        <div className="space-y-3">
          {invites.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
              No pending invites yet. Invite a teammate when you want to bring operators or admins into the workspace.
            </div>
          ) : invites.map((invite) => {
            const inviteUrl = `${inviteBaseUrl}/auth/register?invite=${invite.token}`;
            return (
              <div key={invite.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-black tracking-tight text-slate-950">{invite.email}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {invite.role} · {invite.status} · expires {new Date(invite.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => copyInvite(inviteUrl)}>
                    Copy link
                  </Button>
                </div>
                <code className="mt-4 block break-all rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">{inviteUrl}</code>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
