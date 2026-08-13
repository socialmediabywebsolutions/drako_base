import { run } from "@/lib/db";
import { env } from "@/lib/cf";

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

export type SocialflowAiUsageParams = {
  tenantId: string;
  agent: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  durationSeconds?: number;
  neurons?: number;
};

// Log fila-a-fila de consumo de IA por tenant en SOCIAL_DB (socialflow_ai_usage_log) —
// distinto de reportAiUsage de arriba, que agrega en ai_usage_counters (DRACO_DB). Usa
// env().SOCIAL_DB directamente (no el helper run() de @/lib/db, que resuelve DRACO_DB)
// porque este log es específico de SocialFlow y debe funcionar también dentro de
// socialflow-ai-worker, que solo tiene SOCIAL_DB bindeado (ver wrangler.workers.toml).
export async function reportSocialflowAiUsage(params: SocialflowAiUsageParams): Promise<void> {
  if (!params.tenantId) return;

  const db = env()?.SOCIAL_DB;
  if (!db) return;

  try {
    await db
      .prepare(
        `INSERT INTO socialflow_ai_usage_log (tenant_id, agent, model, input_tokens, output_tokens, duration_seconds, neurons)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        params.tenantId,
        params.agent,
        params.model,
        params.inputTokens ?? null,
        params.outputTokens ?? null,
        params.durationSeconds ?? null,
        params.neurons ?? null,
      )
      .run();
  } catch (err) {
    // Non-fatal — never let usage tracking break the actual AI call.
    console.error("SOCIALFLOW_AI_USAGE_LOG_FAILED", {
      tenantId: params.tenantId,
      agent: params.agent,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
