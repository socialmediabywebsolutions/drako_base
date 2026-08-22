import type { WeeklyPublishStatus } from "@/lib/socialflow/billing/enforce";

type QuotaTileData = { label: string; used: number; limit: number; color: string; shadowClass: string; sublabel?: string };

function QuotaTile({ label, used, limit, color, shadowClass, sublabel }: QuotaTileData) {
  return (
    <div
      className={`transition-all duration-300 hover:-translate-y-0.5 ${shadowClass}`}
      style={{ borderRadius: 8, padding: "8px 10px", background: "rgba(255,255,255,0.04)", border: `1.5px solid ${color}` }}
    >
      <p style={{ fontSize: 7, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#64748b" }}>
        {label}
      </p>
      <p style={{ marginTop: 2, fontSize: 24, fontWeight: 800, color }}>{used}</p>
      <p style={{ marginTop: 2, fontSize: 8, color: "#94a3b8" }}>
        /{limit}{sublabel ? ` · ${sublabel}` : ""}
      </p>
    </div>
  );
}

export default function QuotaCard({ status, planLabel }: { status: WeeklyPublishStatus; planLabel: string }) {
  const tiles: QuotaTileData[] = [
    {
      label: "Instagram · Semana",
      used: status.instagram.used,
      limit: status.instagram.limit,
      color: "#6D5DFB",
      shadowClass: "hover:shadow-[0_8px_20px_rgba(109,93,251,0.35)]",
      sublabel: `hoy ${status.instagramDaily.used}/${status.instagramDaily.cap}`,
    },
    {
      label: "Historias · Hoy",
      used: status.stories.used,
      limit: status.stories.cap,
      color: "#F58529",
      shadowClass: "hover:shadow-[0_8px_20px_rgba(245,133,41,0.35)]",
    },
    {
      label: "LinkedIn · Semana",
      used: status.linkedin.used,
      limit: status.linkedin.limit,
      color: "#00C2A8",
      shadowClass: "hover:shadow-[0_8px_20px_rgba(0,194,168,0.35)]",
    },
  ];

  return (
    <div>
      <p style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.4)", marginBottom: 4 }}>
        Publicaciones · {planLabel}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
        {tiles.map((tile) => (
          <QuotaTile key={tile.label} {...tile} />
        ))}
      </div>
    </div>
  );
}
