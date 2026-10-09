// La cuota diaria (DAILY_CAP en enforce.ts) es fija en 2 para todos los planes — este
// componente recibe solo el booleano isAtDailyCap, no el conteo exacto, así que el "2/2"
// del mensaje es el techo fijo, no un valor calculado.
const DAILY_CAP = 2;

export default function QuotaBanner({
  isAtDailyCap,
  isOverWeeklyQuota,
  weeklyUsed,
  weeklyLimit,
}: {
  isAtDailyCap: boolean;
  isOverWeeklyQuota: boolean;
  weeklyUsed: number;
  weeklyLimit: number;
}) {
  if (!isAtDailyCap && !isOverWeeklyQuota) return null;

  const variant = isAtDailyCap
    ? { background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)", color: "#991b1b" }
    : { background: "rgba(251,191,36,0.1)", borderColor: "rgba(251,191,36,0.3)", color: "#92400e" };

  const message = isAtDailyCap
    ? `🛑 Techo diario alcanzado (${DAILY_CAP}/${DAILY_CAP}). Mañana se renueva tu cuota diaria.`
    : `⚠️ Has alcanzado el máximo recomendado por Instagram esta semana (${weeklyUsed}/${weeklyLimit}). Puedes seguir publicando pero puede afectar tu alcance orgánico.`;

  return (
    <div
      className="mb-6"
      style={{
        background: variant.background,
        border: `1px solid ${variant.borderColor}`,
        color: variant.color,
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {message}
    </div>
  );
}
