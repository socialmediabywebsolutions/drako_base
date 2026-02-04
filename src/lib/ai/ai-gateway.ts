import { fetchWithCorrelation } from "../api-client";
import {
    CORRELATION_HEADER,
    TENANT_HEADER,
    SAAS_HEADER
} from "../correlation";

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
    const metadata = buildAiGatewayMetadata(meta);

    return fetchWithCorrelation(gatewayUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "cf-aigw-metadata": metadata,
        },
        body: JSON.stringify(payload),
    });
}
