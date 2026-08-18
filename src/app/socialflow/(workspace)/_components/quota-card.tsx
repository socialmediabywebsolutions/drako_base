import type { WeeklyPublishStatus } from "@/lib/socialflow/billing/enforce";

function ProgressBar({ used, limit, color }: { used: number; limit: number; color: string }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : used > 0 ? 100 : 0;
  return (
    <div style={{ background: "rgba(0,0,0,0.08)", borderRadius: 999, height: 6, overflow: "hidden" }}>
      <div style={{ width: `${percent}%`, height: "100%", background: color, borderRadius: 999 }} />
    </div>
  );
}

function pluralize(count: number, suffix = ""): string {
  return `${count} restante${count === 1 ? "" : "s"}${suffix}`;
}

function QuotaColumn({
  label,
  used,
  limit,
  remainingLabel,
  color,
  highlightWash,
}: {
  label: string;
  used: number;
  limit: number;
  remainingLabel: string;
  color: string;
  highlightWash: string | null;
}) {
  return (
    <div
      style={{
        borderRadius: 10,
        padding: highlightWash ? "10px 12px" : "0",
        background: highlightWash ?? "transparent",
      }}
    >
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6b7280" }}>
        {label}
      </p>
      <p style={{ marginTop: 4, fontSize: 26, fontWeight: 800, color: "#0f0f1a" }}>
        {used}
        <span style={{ fontSize: 14, fontWeight: 600, color: "#9ca3af" }}>/{limit}</span>
      </p>
      <div style={{ marginTop: 8 }}>
        <ProgressBar used={used} limit={limit} color={color} />
      </div>
      <p style={{ marginTop: 6, fontSize: 11, fontWeight: 500, color: "#6b7280" }}>{remainingLabel}</p>
    </div>
  );
}

export default function QuotaCard({ status, planLabel }: { status: WeeklyPublishStatus; planLabel: string }) {
  const weeklyColor = status.isOverWeeklyQuota ? "#F59E0B" : "#6D5DFB";
  const dailyColor = status.isAtDailyCap ? "#EF4444" : "#F58529";
  const dailyRemaining = Math.max(0, status.dailyCap - status.dailyUsed);

  return (
    <div
      style={{
        background: "#ffffff",
        borderRadius: 16,
        padding: "20px 24px",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0f0f1a" }}>Publicaciones</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: "#6b7280" }}>{planLabel}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
        <QuotaColumn
          label="Esta semana"
          used={status.used}
          limit={status.limit}
          remainingLabel={pluralize(status.remaining)}
          color={weeklyColor}
          highlightWash={status.isOverWeeklyQuota ? "rgba(245,158,11,0.08)" : null}
        />
        <QuotaColumn
          label="Este mes"
          used={status.monthlyUsed}
          limit={status.monthlyLimit}
          remainingLabel={pluralize(status.monthlyRemaining)}
          color="#00C2A8"
          highlightWash={null}
        />
        <QuotaColumn
          label="Hoy"
          used={status.dailyUsed}
          limit={status.dailyCap}
          remainingLabel={pluralize(dailyRemaining, " hoy")}
          color={dailyColor}
          highlightWash={status.isAtDailyCap ? "rgba(239,68,68,0.08)" : null}
        />
      </div>
    </div>
  );
}
