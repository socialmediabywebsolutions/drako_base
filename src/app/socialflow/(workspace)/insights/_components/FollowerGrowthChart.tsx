"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FollowerHistoryPoint } from "@/lib/social-core/types";

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function FollowerGrowthChart({ history }: { history: FollowerHistoryPoint[] }) {
  if (history.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-sm text-white/30">
        Todavía no hay suficiente historial de seguidores — vuelve en unos días.
      </div>
    );
  }

  const data = history.map((point) => ({ label: formatDayLabel(point.capturedAt), followers: point.followersCount }));

  return (
    <div className="h-72 rounded-2xl border border-white/8 bg-white/5 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="label" stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} />
          <YAxis stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "#161221", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: "rgba(255,255,255,0.6)" }}
          />
          <Line type="monotone" dataKey="followers" name="Seguidores" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
