import { run } from "@/lib/db";

export type AiUsageParams = {
  tenantId: string;
  saasId: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
};

export async function reportAiUsage(params: AiUsageParams): Promise<void> {
  if (!params.tenantId || !params.saasId) return;

  const now = new Date();
  const month = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const key = `${params.tenantId}:${params.saasId}:${params.model}:${month}`;

  try {
    await run(
      `INSERT INTO ai_usage_counters (key, tokens_in, tokens_out, requests_count, saas_id, model, updated_at)
       VALUES (?, ?, ?, 1, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         tokens_in    = tokens_in + excluded.tokens_in,
         tokens_out   = tokens_out + excluded.tokens_out,
         requests_count = requests_count + 1,
         updated_at   = excluded.updated_at`,
      key,
      params.tokensIn,
      params.tokensOut,
      params.saasId,
      params.model,
      now.toISOString(),
    );
  } catch (err) {
    // Non-fatal — never let usage tracking break the actual AI call.
    console.error("AI_USAGE_REPORT_FAILED", {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
