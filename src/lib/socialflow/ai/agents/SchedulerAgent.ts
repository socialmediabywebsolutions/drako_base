import type { ScheduledPostPlan, StrategyItem } from "../types";

export class SchedulerAgent {
  run(input: { strategy: StrategyItem[]; frequencyPerWeek: number }): ScheduledPostPlan[] {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    return input.strategy.map((item, index) => {
      const offsetDays = item.dayOffset;
      const scheduledAt = new Date(now + offsetDays * dayMs + index * 60 * 60 * 1000).toISOString();
      return {
        id: `sched_${item.id}`,
        postId: item.id,
        scheduledAt,
      };
    });
  }
}
