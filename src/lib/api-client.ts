import "server-only";
import { headers } from "next/headers";
import {
    CORRELATION_HEADER,
    TENANT_HEADER,
    SAAS_HEADER
} from "./correlation";

/**
 * Drako-Forge Steel v1.0.1 - Propagating API Client
 * 
 * This client ensures that the Correlation ID and Tenant Context 
 * are propagated from the Vercel request to the Cloudflare Worker.
 */

export async function fetchWithCorrelation(
    url: string | URL,
    options: RequestInit = {}
): Promise<Response> {
    const headersList = await headers();

    // Extract context from current request headers (injected by middleware)
    const correlationId = headersList.get(CORRELATION_HEADER);
    const tenantId = headersList.get(TENANT_HEADER);
    const saasId = headersList.get(SAAS_HEADER);

    // Prepare outgoing headers
    const outgoingHeaders = new Headers(options.headers || {});

    if (correlationId) {
        outgoingHeaders.set(CORRELATION_HEADER, correlationId);
    }

    if (tenantId) {
        outgoingHeaders.set(TENANT_HEADER, tenantId);
    }

    if (saasId) {
        outgoingHeaders.set(SAAS_HEADER, saasId);
    }

    // Steel v1.0.1: Internal Worker API authentication
    // Note: CLOUDFLARE_WORKER_SECRET should be defined in environment variables
    const workerSecret = process.env.CLOUDFLARE_WORKER_SECRET;
    if (workerSecret) {
        outgoingHeaders.set("Authorization", `Bearer ${workerSecret}`);
    }

    // Steel v1.0.1: Correlation tracking for logs
    console.log(`[CORE] [${correlationId || 'no-id'}] Fetching ${url}`);

    return fetch(url, {
        ...options,
        headers: outgoingHeaders,
    });
}
