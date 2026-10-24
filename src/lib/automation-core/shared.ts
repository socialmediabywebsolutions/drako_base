import type {
  AutomationConfig,
  AutomationExecutionResult,
  AutomationMetrics,
  AutomationOutput,
} from "@/lib/automation-core/types";

export function nowIso(): string {
  return new Date().toISOString();
}

export function generateId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.()
    ? `${prefix}_${globalThis.crypto.randomUUID()}`
    : `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export function parseJsonObject<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}

export function normalizeConfig(value: AutomationConfig | undefined): AutomationConfig {
  return value ?? null;
}

export function normalizeMetrics(value: Record<string, unknown> | null | undefined): AutomationMetrics {
  if (!value || typeof value !== "object") {
    return {};
  }

  const metrics: AutomationMetrics = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw)) {
      metrics[key] = raw;
    }
  }
  return metrics;
}

export function normalizeOutput(value: Record<string, unknown> | null | undefined): AutomationOutput {
  return value ?? null;
}

export function normalizeExecutionResult(
  result: AutomationExecutionResult,
): Required<Pick<AutomationExecutionResult, "ok">> & {
  summary: string | null;
  metrics: AutomationMetrics;
  output: AutomationOutput;
  error: { code: string; message: string } | null;
} {
  return {
    ok: result.ok,
    summary: result.summary ?? null,
    metrics: normalizeMetrics(result.metrics ?? {}),
    output: normalizeOutput(result.output ?? null),
    error: result.ok
      ? null
      : {
          code: result.error?.code ?? "AUTOMATION_EXECUTION_FAILED",
          message: result.error?.message ?? result.summary ?? "Automation execution failed",
        },
  };
}
