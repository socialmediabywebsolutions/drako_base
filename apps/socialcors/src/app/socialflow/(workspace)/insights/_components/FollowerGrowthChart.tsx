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
      <div className="flex h-64 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-400">
        Todavía no hay suficiente historial de seguidores — vuelve en unos días.
      </div>
    );
  }

  const data = history.map((point) => ({ label: formatDayLabel(point.capturedAt), followers: point.followersCount }));

  return (
    <div className="h-72 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,24,39,0.08)" />
          <XAxis dataKey="label" stroke="rgba(17,24,39,0.45)" fontSize={11} tickLine={false} />
          <YAxis stroke="rgba(17,24,39,0.45)" fontSize={11} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 12px rgba(17,24,39,0.08)" }}
            labelStyle={{ color: "#6b7280" }}
            itemStyle={{ color: "#111827" }}
          />
          <Line type="monotone" dataKey="followers" name="Seguidores" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
