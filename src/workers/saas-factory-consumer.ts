import { type MessageBatch, type Queue } from "@cloudflare/workers-types";
import { setGlobalEnv, type DracoEnv } from "@/lib/cf";
import { run } from "@/lib/db";

type LegacySaasFactoryJobMessage = {
  correlationId?: string;
  saasSlug?: string;
};

export interface Env extends DracoEnv {
  SAAS_FACTORY_QUEUE: Queue<LegacySaasFactoryJobMessage>;
}

export default {
  async queue(batch: MessageBatch<LegacySaasFactoryJobMessage>, env: Env): Promise<void> {
    setGlobalEnv(env);
    console.warn(`[SaasFactoryWorker] LEGACY_SAAS_FACTORY_QUEUE_BLOCKED: ${batch.messages.length} message(s) received.`);

    for (const message of batch.messages) {
      const correlationId = message.body?.correlationId ?? `legacy_saas_factory_${Date.now()}`;
      const saasSlug = message.body?.saasSlug ?? "unknown";
      try {
        await run(
          `INSERT INTO billing_audit_logs (id, saas_slug, event_type, severity, correlation_id, metadata_json)
           VALUES (?, ?, ?, ?, ?, ?)`,
          `legacy_${correlationId}`,
          saasSlug,
          "legacy.saas_factory_queue.blocked",
          "CRITICAL",
          correlationId,
          JSON.stringify({
            message: "Legacy SAAS_FACTORY_QUEUE is decommissioned. Use /api/owner/saas-factory/create-saas canonical flow.",
          }),
        );
      } catch (error) {
        console.error("[SaasFactoryWorker] Failed to persist legacy queue block audit", error);
      } finally {
        message.ack();
      }
    }
  },
};
