import { fetchWithCorrelation } from "../api-client";
import { checkAiGovernance, recordAiSuccess, recordAiFailure } from "../security/governor";

/**
 * Drako-Forge Steel v1.0.1 - AI Gateway Utility
 * 
 * Implements the cf-aigw-metadata header and governance rules.
 */

export type AiMetadata = {
    correlationId: string;
    tenantId?: string;
    saasId?: string;
    agentId?: string;
    plan?: string;
    mode?: "prod" | "staging" | "dev";
};

/**
 * Builds the cf-aigw-metadata header for Cloudflare AI Gateway.
 */
export function buildAiGatewayMetadata(meta: AiMetadata): string {
    // Steel v1.0.1: metadata without PII and reasonable size
    const data = {
        correlation_id: meta.correlationId.toLowerCase(),
        tenant_id: meta.tenantId,
        saas_id: meta.saasId,
        agent_id: meta.agentId,
        plan: meta.plan || "standard",
        mode: meta.mode || (process.env.NODE_ENV === "production" ? "prod" : "dev"),
    };

    return JSON.stringify(data);
}

/**
 * Executes a call through AI Gateway with correlation and metadata.
 */
export async function callAiGateway(
    gatewayUrl: string,
    payload: any,
    meta: AiMetadata
): Promise<Response> {
    const correlationId = meta.correlationId;
    const governance = await checkAiGovernance({
        tenantId: meta.tenantId || "system",
        breakerKey: `ai:gateway:${meta.agentId || 'default'}`,
        correlationId,
    });

    if (!governance.allowed) {
        return new Response(JSON.stringify({
            error: "AI_GOVERNANCE_BLOCKED",
            reason: governance.reason,
            correlation_id: correlationId
        }), {
            status: 429,
            headers: { "Content-Type": "application/json" }
        });
    }

    const metadata = buildAiGatewayMetadata(meta);

    try {
        const response = await fetchWithCorrelation(gatewayUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "cf-aigw-metadata": metadata,
            },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            await recordAiSuccess(`ai:gateway:${meta.agentId || 'default'}`);
        } else if (response.status >= 500) {
            await recordAiFailure({
                breakerKey: `ai:gateway:${meta.agentId || 'default'}`,
                error: `HTTP_${response.status}`,
                correlationId,
                threshold: 5
            });
        }

        return response;
    } catch (error) {
        await recordAiFailure({
            breakerKey: `ai:gateway:${meta.agentId || 'default'}`,
            error: String(error),
            correlationId,
            threshold: 5
        });
        throw error;
    }
}
