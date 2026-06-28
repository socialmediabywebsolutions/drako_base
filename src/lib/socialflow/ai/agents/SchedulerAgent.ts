import type { ScheduledPostPlan, StrategyItem } from "../types";

const FITNESS_LIFESTYLE_HOURS = [7, 12, 18] as const;
const DEFAULT_HOURS = [9, 18] as const;

const FITNESS_LIFESTYLE_RE = /fitness|lifestyle|wellness|salud\b|health|gym|sport|yoga|pilates|nutrici[oó]n|coach|entrenami|ejercici/i;

function pickHour(niche: string | undefined, dateStr: string, slotIndex?: number): number {
  const hours = niche && FITNESS_LIFESTYLE_RE.test(niche) ? FITNESS_LIFESTYLE_HOURS : DEFAULT_HOURS;
  if (slotIndex !== undefined) {
    return hours[slotIndex % hours.length];
  }
  const dayOfMonth = parseInt(dateStr.slice(8, 10), 10);
  return hours[dayOfMonth % hours.length];
}

// Build (dateStr, hour) slots for `numDays` days starting at fromDateStr, wave-by-wave:
// first every day at hours[0], then every day at hours[1], then hours[2].
// This fills all days evenly before any day receives a second slot.
function buildSlots(
  niche: string | undefined,
  fromDateStr: string,
  numDays: number,
): Array<{ dateStr: string; hour: number }> {
  const hours = niche && FITNESS_LIFESTYLE_RE.test(niche)
    ? ([...FITNESS_LIFESTYLE_HOURS] as number[])
    : ([...DEFAULT_HOURS] as number[]);

  const DAY_MS = 86_400_000;
  const dayList: string[] = [];
  let cursor = new Date(fromDateStr + "T00:00:00Z").getTime();
  for (let i = 0; i < numDays; i++) {
    dayList.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += DAY_MS;
  }

  // Wave-by-wave: slot 0 across all days, then slot 1, then slot 2
  const slots: Array<{ dateStr: string; hour: number }> = [];
  for (const hour of hours) {
    for (const day of dayList) {
      slots.push({ dateStr: day, hour });
    }
  }
  return slots;
}

export class SchedulerAgent {
  run(input: {
    strategy: StrategyItem[];
    frequencyPerWeek: number;
    startDate?: string | null;
    endDate?: string | null;
    niche?: string;
    occupiedSlots?: string[];  // ISO date-times already scheduled in DB
  }): ScheduledPostPlan[] {
    const n = input.strategy.length;
    if (n === 0) return [];

    const DAY_MS = 86_400_000;
    const now = Date.now();

    const startMs = input.startDate
      ? new Date(input.startDate + "T00:00:00Z").getTime()
      : now + DAY_MS;
    const rangeStart = new Date(startMs).toISOString().slice(0, 10);

    // Occupied set keyed as "YYYY-MM-DDTHH" for O(1) collision checks
    const occupiedKeys = new Set<string>(
      (input.occupiedSlots ?? []).map((iso) => iso.slice(0, 13)),
    );

    // 62 days covers current + next month from startDate
    const allSlots = buildSlots(input.niche, rangeStart, 62);
    const available = allSlots.filter(({ dateStr, hour }) => {
      const key = `${dateStr}T${String(hour).padStart(2, "0")}`;
      return !occupiedKeys.has(key);
    });

    return input.strategy.map((item, index) => {
      const slot = available[index];

      if (!slot) {
        // Fallback: linear spread if slots somehow exhausted (62-day range, 186 slots max)
        const endMs = Math.max(
          input.endDate
            ? new Date(input.endDate + "T23:59:00Z").getTime()
            : startMs + 6 * DAY_MS,
          startMs + DAY_MS - 1,
        );
        const t = n === 1 ? 0.5 : index / (n - 1);
        const postDate = new Date(startMs + t * (endMs - startMs));
        const dateStr = postDate.toISOString().slice(0, 10);
        postDate.setUTCHours(pickHour(input.niche, dateStr), 0, 0, 0);
        return { id: `sched_${item.id}`, postId: item.id, scheduledAt: postDate.toISOString() };
      }

      // Mark slot occupied so later posts in this batch don't collide
      occupiedKeys.add(`${slot.dateStr}T${String(slot.hour).padStart(2, "0")}`);

      const postDate = new Date(slot.dateStr + "T00:00:00Z");
      postDate.setUTCHours(slot.hour, 0, 0, 0);

      return {
        id: `sched_${item.id}`,
        postId: item.id,
        scheduledAt: postDate.toISOString(),
      };
    });
  }
}
