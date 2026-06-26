import type { ScheduledPostPlan, StrategyItem } from "../types";

// Preferred posting hours cycle
const POSTING_HOURS = [9, 12, 15, 18, 10, 14, 17, 11, 16, 13, 19, 8] as const;

export class SchedulerAgent {
  run(input: {
    strategy: StrategyItem[];
    frequencyPerWeek: number;
    startDate?: string | null;
    endDate?: string | null;
  }): ScheduledPostPlan[] {
    const n = input.strategy.length;
    if (n === 0) return [];

    const DAY_MS = 86_400_000;
    const now = Date.now();

    // Parse range boundaries. Default: start today, span 7 days.
    const startMs = input.startDate
      ? new Date(input.startDate + "T00:00:00").getTime()
      : now;
    const rawEndMs = input.endDate
      ? new Date(input.endDate + "T23:59:00").getTime()
      : startMs + 6 * DAY_MS;
    const endMs = Math.max(rawEndMs, startMs + DAY_MS - 1);

    return input.strategy.map((item, index) => {
      // Distribute evenly: first post at startMs, last post at endMs
      const t = n === 1 ? 0.5 : index / (n - 1);
      const baseMs = startMs + t * (endMs - startMs);

      const postDate = new Date(baseMs);
      postDate.setHours(POSTING_HOURS[index % POSTING_HOURS.length], 0, 0, 0);

      // Clamp if hour rounding pushed past end of range
      if (postDate.getTime() > endMs) {
        postDate.setTime(endMs);
        postDate.setHours(18, 0, 0, 0);
      }

      return {
        id: `sched_${item.id}`,
        postId: item.id,
        scheduledAt: postDate.toISOString(),
      };
    });
  }
}
