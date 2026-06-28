import type { ScheduledPostPlan, StrategyItem } from "../types";

const FITNESS_LIFESTYLE_HOURS = [7, 12, 18] as const;
const DEFAULT_HOURS = [9, 18] as const;

const FITNESS_LIFESTYLE_RE = /fitness|lifestyle|wellness|salud\b|health|gym|sport|yoga|pilates|nutrici[oó]n|coach|entrenami|ejercici/i;

function pickHour(niche: string | undefined, dateStr: string): number {
  const hours = niche && FITNESS_LIFESTYLE_RE.test(niche) ? FITNESS_LIFESTYLE_HOURS : DEFAULT_HOURS;
  const dayOfMonth = parseInt(dateStr.slice(8, 10), 10);
  return hours[dayOfMonth % hours.length];
}

export class SchedulerAgent {
  run(input: {
    strategy: StrategyItem[];
    frequencyPerWeek: number;
    startDate?: string | null;
    endDate?: string | null;
    niche?: string;
  }): ScheduledPostPlan[] {
    const n = input.strategy.length;
    if (n === 0) return [];

    const DAY_MS = 86_400_000;
    const now = Date.now();

    const startMs = input.startDate
      ? new Date(input.startDate + "T00:00:00Z").getTime()
      : now;
    const rawEndMs = input.endDate
      ? new Date(input.endDate + "T23:59:00Z").getTime()
      : startMs + 6 * DAY_MS;
    const endMs = Math.max(rawEndMs, startMs + DAY_MS - 1);

    return input.strategy.map((item, index) => {
      const t = n === 1 ? 0.5 : index / (n - 1);
      const baseMs = startMs + t * (endMs - startMs);

      const postDate = new Date(baseMs);
      const dateStr = postDate.toISOString().slice(0, 10);
      const hour = pickHour(input.niche, dateStr);
      postDate.setUTCHours(hour, 0, 0, 0);

      if (postDate.getTime() > endMs) {
        postDate.setTime(endMs);
        postDate.setUTCHours(18, 0, 0, 0);
      }

      return {
        id: `sched_${item.id}`,
        postId: item.id,
        scheduledAt: postDate.toISOString(),
      };
    });
  }
}
