import { DEV_ARCHITECT_CHECKLIST_RULES } from "@/lib/dev-architects/data";
import type { DevArchitectChecklistStatus } from "@/lib/dev-architects/types";

export type DevArchitectAuditSummaryRule = {
  key: string;
  label: string;
  status: DevArchitectChecklistStatus;
  notes?: string[];
  durationMs?: number;
};

export type DevArchitectAuditSummary = {
  statusGlobal: "OK" | "WARNING";
  executedAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  rules: DevArchitectAuditSummaryRule[];
  notes?: string[];
};

type RawAuditSummary = {
  type?: string;
  status?: string;
  executedAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  durationMs?: number | null;
  results?: Record<string, { status?: string; notes?: string[]; durationMs?: number }>;
  notes?: string[];
};

const RULE_LABEL_INDEX = DEV_ARCHITECT_CHECKLIST_RULES.reduce<Record<string, string>>((acc, rule) => {
  acc[rule.key] = rule.label;
  return acc;
}, {});

export function parseAuditSummary(raw?: string | null): DevArchitectAuditSummary | null {
  if (!raw) return null;
  let parsed: RawAuditSummary;
  try {
    parsed = JSON.parse(raw) as RawAuditSummary;
  } catch {
    return null;
  }
  if (parsed.type !== "audit") return null;
  const status = parsed.status?.toLowerCase();
  const statusGlobal: DevArchitectAuditSummary["statusGlobal"] | null =
    status === "ok" ? "OK" : status === "warning" ? "WARNING" : null;
  if (!statusGlobal) return null;
  const results = parsed.results ?? {};
  const rules: DevArchitectAuditSummaryRule[] = Object.entries(results).map(([key, result]) => ({
    key,
    label: RULE_LABEL_INDEX[key] ?? key,
    status: result.status === "ok" ? "ok" : "pending",
    notes: result.notes,
    durationMs: result.durationMs,
  }));
  return {
    statusGlobal,
    executedAt: parsed.executedAt,
    startedAt: parsed.startedAt ?? null,
    finishedAt: parsed.finishedAt ?? null,
    durationMs: parsed.durationMs ?? null,
    notes: parsed.notes,
    rules,
  };
}
