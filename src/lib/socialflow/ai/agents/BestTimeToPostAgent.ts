import type { PostEngagementHourPoint } from "@/lib/social-core/types";
import { getRecentPostEngagementByHour, type SocialContext } from "@/lib/socialflow/repository";

const LOOKBACK_DAYS = 90;
const MIN_POSTS_PER_FORMAT = 5;
const TRACKED_FORMATS = ["FEED", "REEL", "STORY", "CAROUSEL"] as const;

export type BestHourByFormat = Record<(typeof TRACKED_FORMATS)[number], number | null>;

// Pura, testeable sin D1 — mismo patrón que computeEngagementPatterns en
// EngagementLearningAgent.ts. El umbral de MIN_POSTS_PER_FORMAT es por formato
// (independiente por clave): un formato sin datos suficientes queda en null, los demás
// formatos con datos sí se calculan — nunca se colapsa el resultado entero a null.
export function computeBestHourByFormat(points: PostEngagementHourPoint[]): BestHourByFormat {
  const result = { FEED: null, REEL: null, STORY: null, CAROUSEL: null } as BestHourByFormat;

  for (const format of TRACKED_FORMATS) {
    const formatPoints = points.filter((p) => p.contentType === format);
    if (formatPoints.length < MIN_POSTS_PER_FORMAT) continue;

    const byHour = new Map<number, { total: number; count: number }>();
    for (const p of formatPoints) {
      const bucket = byHour.get(p.hourUtc) ?? { total: 0, count: 0 };
      bucket.total += p.engagement;
      bucket.count += 1;
      byHour.set(p.hourUtc, bucket);
    }

    const best = Array.from(byHour.entries())
      .map(([hour, { total, count }]) => ({ hour, avg: total / count }))
      .sort((a, b) => b.avg - a.avg)[0];

    if (best) result[format] = best.hour;
  }

  return result;
}

// Parsea bestHourByFormat de un StyleSnapshot.snapshotJson — exportada para reuso
// cross-módulo, mismo patrón que extractTrendSignals en TrendKeywordAgent.ts. Nunca
// confiar ciegamente en la forma de un JSON guardado, mismo criterio que ese validador.
export function extractBestHourByFormat(snapshotJson: string): BestHourByFormat | null {
  try {
    const parsed = JSON.parse(snapshotJson);
    const raw = parsed?.bestHourByFormat;
    if (!raw || typeof raw !== "object") return null;
    const candidate = raw as Partial<Record<(typeof TRACKED_FORMATS)[number], unknown>>;
    const result = { FEED: null, REEL: null, STORY: null, CAROUSEL: null } as BestHourByFormat;
    for (const format of TRACKED_FORMATS) {
      const value = candidate[format];
      result[format] = typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 24 ? value : null;
    }
    return result;
  } catch {
    return null;
  }
}

export class BestTimeToPostAgent {
  async run(ctx: SocialContext): Promise<BestHourByFormat> {
    const points = await getRecentPostEngagementByHour(ctx, LOOKBACK_DAYS);
    return computeBestHourByFormat(points);
  }
}
