"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SocialInsightsWeeklyFormatPoint } from "@/lib/social-core/types";

const SERIES: { key: "FEED" | "REEL" | "STORY" | "CAROUSEL"; label: string; color: string }[] = [
  { key: "FEED", label: "Posts", color: "#3b82f6" },
  { key: "REEL", label: "Reels", color: "#22c55e" },
  { key: "STORY", label: "Historias", color: "#eab308" },
  { key: "CAROUSEL", label: "Carruseles", color: "#a855f7" },
];

export default function ReachByFormatChart({ data }: { data: SocialInsightsWeeklyFormatPoint[] }) {
  const hasData = data.some((point) => SERIES.some((series) => point[series.key] > 0));

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-400">
        Aún no hay suficiente alcance publicado para graficar por formato.
      </div>
    );
  }

  return (
    <div className="h-72 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(17,24,39,0.08)" />
          <XAxis dataKey="weekLabel" stroke="rgba(17,24,39,0.45)" fontSize={11} tickLine={false} />
          <YAxis stroke="rgba(17,24,39,0.45)" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 12, boxShadow: "0 4px 12px rgba(17,24,39,0.08)" }}
            labelStyle={{ color: "#6b7280" }}
            itemStyle={{ color: "#111827" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#4b5563" }} />
          {SERIES.map((series) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
