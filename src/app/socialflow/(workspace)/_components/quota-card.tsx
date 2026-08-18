import type { WeeklyPublishStatus } from "@/lib/socialflow/billing/enforce";

function ProgressBar({ used, limit, color }: { used: number; limit: number; color: string }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : used > 0 ? 100 : 0;
  return (
    <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 2, height: 4, overflow: "hidden" }}>
      <div style={{ width: `${percent}%`, height: "100%", background: color, borderRadius: 2 }} />
    </div>
  );
}

function QuotaColumn({ label, used, limit, color }: { label: string; used: number; limit: number; color: string }) {
  return (
    <div style={{ minWidth: 64 }}>
      <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
        {label}
      </p>
      <p style={{ marginTop: 2, fontSize: 13, fontWeight: 700, color }}>
        {used}
        <span style={{ fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>/{limit}</span>
      </p>
      <div style={{ marginTop: 4 }}>
        <ProgressBar used={used} limit={limit} color={color} />
      </div>
    </div>
  );
}

export default function QuotaCard({ status, planLabel }: { status: WeeklyPublishStatus; planLabel: string }) {
  const weeklyColor = status.isOverWeeklyQuota ? "#F59E0B" : "#6D5DFB";
  const dailyColor = status.isAtDailyCap ? "#EF4444" : "#F58529";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "10px 14px",
        borderRadius: 10,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: "#ffffff" }}>Publicaciones</span>

      <div style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,0.08)" }} />

      <QuotaColumn label="Semana" used={status.used} limit={status.limit} color={weeklyColor} />
      <QuotaColumn label="Mes" used={status.monthlyUsed} limit={status.monthlyLimit} color="#00C2A8" />
      <QuotaColumn label="Hoy" used={status.dailyUsed} limit={status.dailyCap} color={dailyColor} />

      <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>
        {planLabel}
      </span>
    </div>
  );
}
