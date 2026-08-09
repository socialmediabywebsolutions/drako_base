"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SocialInsightsWeeklyFormatPoint } from "@/lib/social-core/types";

const SERIES: { key: "FEED" | "REEL" | "STORY" | "CAROUSEL"; label: string; color: string }[] = [
  { key: "FEED", label: "Posts", color: "#3b82f6" },
  { key: "REEL", label: "Reels", color: "#22c55e" },
  { key: "STORY", label: "Historias", color: "#eab308" },
  { key: "CAROUSEL", label: "Carruseles", color: "#a855f7" },
];

export default function LikesCommentsByFormatChart({ data }: { data: SocialInsightsWeeklyFormatPoint[] }) {
  const hasData = data.some((point) => SERIES.some((series) => point[series.key] > 0));

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-sm text-white/30">
        Aún no hay suficiente engagement publicado para graficar por formato.
      </div>
    );
  }

  return (
    <div className="h-72 rounded-2xl border border-white/8 bg-white/5 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="weekLabel" stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} />
          <YAxis stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: "#161221", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, fontSize: 12 }}
            labelStyle={{ color: "rgba(255,255,255,0.6)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }} />
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
