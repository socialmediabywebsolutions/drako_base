import { AutopilotEnv } from "../index";

export interface AlertPayload {
    type: "AI_COST_HARD_BLOCK" | "AI_COST_SOFT_DOWNGRADE" | "AI_LATENCY_DEGRADED" | "AI_ROUTER_ERROR";
    tenantId: string;
    message: string;
    metadata?: Record<string, any>;
}

/**
 * Send System Alert (Ops Sink)
 * Sends a notification to the configured Webhook (Discord/Slack/Resend).
 * Fails silently to allow main flow to continue (fire & forget).
 */
export async function sendAlert(env: AutopilotEnv, payload: AlertPayload): Promise<void> {
    const webhookUrl = env.ALERT_WEBHOOK_URL;

    // Always log to console for Cloudflare Logs
    console.error(`[ALERT] ${payload.type}: ${payload.message}`, payload.metadata);

    if (!webhookUrl) return;

    try {
        // Simple JSON POST
        await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: `🚨 **${payload.type}**\nTenant: \`${payload.tenantId}\`\nMessage: ${payload.message}`,
                ...payload
            })
        });
    } catch (e) {
        console.error("Failed to send alert webhook", e);
    }
}
