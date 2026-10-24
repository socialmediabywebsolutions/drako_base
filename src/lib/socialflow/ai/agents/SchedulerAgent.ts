import { STRATEGY_FORMAT_TO_CONTENT_TYPE, type ScheduledPostPlan, type StrategyItem } from "../types";
import type { SaasSocialContentType } from "@/lib/social-core/types";

const FITNESS_LIFESTYLE_HOURS = [7, 12, 18] as const;
const DEFAULT_HOURS = [9, 18] as const;
const DAY_MS = 86_400_000;
const SCHEDULING_WINDOW_DAYS = 62; // covers current + next month from startDate

const FITNESS_LIFESTYLE_RE = /fitness|lifestyle|wellness|salud\b|health|gym|sport|yoga|pilates|nutrici[oó]n|coach|entrenami|ejercici/i;

function pickHour(hours: number[], dateStr: string, slotIndex?: number): number {
  if (slotIndex !== undefined) return hours[slotIndex % hours.length];
  const dayOfMonth = parseInt(dateStr.slice(8, 10), 10);
  return hours[dayOfMonth % hours.length];
}

// Build (dateStr, hour) slots for `numDays` days starting at fromDateStr, wave-by-wave:
// first every day at hours[0], then every day at hours[1], then hours[2].
// This fills all days evenly before any day receives a second slot.
function buildSlots(
  hours: number[],
  fromDateStr: string,
  numDays: number,
): Array<{ dateStr: string; hour: number }> {
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

// ISO weekday (1=lunes ... 7=domingo) de un dateStr "YYYY-MM-DD" — JS getUTCDay() usa
// 0=domingo..6=sábado, así que domingo (0) se remapea a 7.
function isoWeekdayOfDateStr(dateStr: string): number {
  const day = new Date(dateStr + "T00:00:00Z").getUTCDay();
  return day === 0 ? 7 : day;
}

// Primer día libre (desde fromDateStr, dentro de numDays) para una hora exacta — usado
// cuando un item tiene hora óptima real por formato (BestTimeToPostAgent), en vez del
// pool wave-based de abajo, que reparte entre varias horas genéricas por nicho.
// preferredWeekdays (OptimalPostingScheduleAgent, vía SocialFlowOrchestrator) PRIORIZA
// esos días de la semana con una primera pasada; si ninguno está libre dentro de la
// ventana, cae a la pasada normal sobre cualquier día — nunca deja un item sin fecha
// por falta de un día preferido disponible.
function firstFreeDayForHour(
  hour: number,
  fromDateStr: string,
  numDays: number,
  occupiedKeys: Set<string>,
  preferredWeekdays?: number[],
): string | null {
  const scan = (requirePreferred: boolean): string | null => {
    let cursor = new Date(fromDateStr + "T00:00:00Z").getTime();
    for (let i = 0; i < numDays; i++) {
      const dateStr = new Date(cursor).toISOString().slice(0, 10);
      const key = `${dateStr}T${String(hour).padStart(2, "0")}`;
      if (!occupiedKeys.has(key) && (!requirePreferred || preferredWeekdays!.includes(isoWeekdayOfDateStr(dateStr)))) {
        return dateStr;
      }
      cursor += DAY_MS;
    }
    return null;
  };

  if (preferredWeekdays?.length) {
    const preferred = scan(true);
    if (preferred) return preferred;
  }
  return scan(false);
}

export class SchedulerAgent {
  run(input: {
    strategy: StrategyItem[];
    frequencyPerWeek: number;
    startDate?: string | null;
    endDate?: string | null;
    niche?: string;
    occupiedSlots?: string[];   // ISO date-times already scheduled in DB
    optimalHours?: number[];    // AI-provided UTC hours; falls back to niche heuristic
    // Hora óptima real por content_type (BestTimeToPostAgent, vía socialcors_style_history)
    // — resuelta por el caller (SocialFlowOrchestrator), no leída aquí: este agente se
    // mantiene síncrono y sin I/O. Tiene prioridad sobre optimalHours/niche heuristic
    // para el formato de CADA item que tenga dato suficiente; los demás items (formato
    // sin datos, o mapa ausente) siguen usando el pool de abajo sin ningún cambio.
    optimalHoursByFormat?: Partial<Record<SaasSocialContentType, number>>;
    // Días de la semana con mejor engagement real para este tenant
    // (OptimalPostingScheduleAgent, vía socialcors_posting_schedule) — números ISO
    // (1=lunes...7=domingo). Resuelto por el caller (SocialFlowOrchestrator), igual que
    // optimalHoursByFormat. Solo PRIORIZA esos días dentro de la ventana disponible,
    // nunca descarta un slot por no caer en un día preferido.
    preferredWeekdays?: number[];
  }): ScheduledPostPlan[] {
    const n = input.strategy.length;
    if (n === 0) return [];

    const now = Date.now();

    const startMs = input.startDate
      ? new Date(input.startDate + "T00:00:00Z").getTime()
      : now + DAY_MS;
    const rangeStart = new Date(startMs).toISOString().slice(0, 10);

    // Resolve posting hours: prefer AI-provided, fall back to niche heuristic
    const nicheHours = input.niche && FITNESS_LIFESTYLE_RE.test(input.niche)
      ? ([...FITNESS_LIFESTYLE_HOURS] as number[])
      : ([...DEFAULT_HOURS] as number[]);
    const validAiHours = (input.optimalHours ?? [])
      .filter((h) => Number.isInteger(h) && h >= 0 && h < 24)
      .slice(0, 3);
    const hours = validAiHours.length >= 2 ? validAiHours : nicheHours;

    // Occupied set keyed as "YYYY-MM-DDTHH" for O(1) collision checks
    const occupiedKeys = new Set<string>(
      (input.occupiedSlots ?? []).map((iso) => iso.slice(0, 13)),
    );

    const allSlots = buildSlots(hours, rangeStart, SCHEDULING_WINDOW_DAYS);
    const freeSlots = allSlots.filter(({ dateStr, hour }) => {
      const key = `${dateStr}T${String(hour).padStart(2, "0")}`;
      return !occupiedKeys.has(key);
    });
    // preferredWeekdays reordena el pool (partición estable) para que los días con
    // mejor engagement real vayan primero dentro de cada franja horaria — sin
    // preferredWeekdays, `available` queda idéntico a `freeSlots` (mismo orden
    // wave-by-wave de siempre).
    const available = input.preferredWeekdays?.length
      ? [...freeSlots].sort(
          (a, b) =>
            (input.preferredWeekdays!.includes(isoWeekdayOfDateStr(a.dateStr)) ? 0 : 1)
            - (input.preferredWeekdays!.includes(isoWeekdayOfDateStr(b.dateStr)) ? 0 : 1),
        )
      : freeSlots;
    // Consumido en orden de asignación (no necesariamente el mismo que el índice del
    // item en `strategy`, porque los items con hora óptima por formato no tocan el
    // pool) — cuando optimalHoursByFormat está ausente, cada item lo consume en orden,
    // idéntico al `available[index]` de antes.
    let poolIndex = 0;

    const endMs = Math.max(
      input.endDate
        ? new Date(input.endDate + "T23:59:00Z").getTime()
        : startMs + 6 * DAY_MS,
      startMs + DAY_MS - 1,
    );

    const assignFromPoolOrFallback = (item: StrategyItem, itemIndex: number): ScheduledPostPlan => {
      const slot = available[poolIndex];

      if (!slot) {
        // Fallback: linear spread if slots somehow exhausted (62-day range, 186 slots max)
        const t = n === 1 ? 0.5 : itemIndex / (n - 1);
        const postDate = new Date(startMs + t * (endMs - startMs));
        const dateStr = postDate.toISOString().slice(0, 10);
        postDate.setUTCHours(pickHour(hours, dateStr), 0, 0, 0);
        return { id: `sched_${item.id}`, postId: item.id, scheduledAt: postDate.toISOString() };
      }

      poolIndex++;
      // Mark slot occupied so later posts in this batch don't collide
      occupiedKeys.add(`${slot.dateStr}T${String(slot.hour).padStart(2, "0")}`);

      const postDate = new Date(slot.dateStr + "T00:00:00Z");
      postDate.setUTCHours(slot.hour, 0, 0, 0);

      return {
        id: `sched_${item.id}`,
        postId: item.id,
        scheduledAt: postDate.toISOString(),
      };
    };

    return input.strategy.map((item, index) => {
      const contentType = STRATEGY_FORMAT_TO_CONTENT_TYPE[item.format];
      const targetHour = input.optimalHoursByFormat?.[contentType];

      if (targetHour !== undefined) {
        const dateStr = firstFreeDayForHour(targetHour, rangeStart, SCHEDULING_WINDOW_DAYS, occupiedKeys, input.preferredWeekdays);
        if (dateStr) {
          occupiedKeys.add(`${dateStr}T${String(targetHour).padStart(2, "0")}`);
          const postDate = new Date(dateStr + "T00:00:00Z");
          postDate.setUTCHours(targetHour, 0, 0, 0);
          return { id: `sched_${item.id}`, postId: item.id, scheduledAt: postDate.toISOString() };
        }
        // Ventana de 62 días agotada para esa hora exacta (caso raro) — cae al pool.
      }

      return assignFromPoolOrFallback(item, index);
    });
  }
}
