import { getDb } from "@/lib/db";
import {
    type GrowthEvent,
    type GrowthEventName,
    type GrowthConversionSource,
    type GrowthCountryCode,
    type GrowthEventPayload
} from "./types";

/**
 * Ingests a raw growth event from the API or internal calls.
 * Validates strictly the tenant and payload.
 */
export async function trackGrowthEvent(params: {
    tenantId: string;
    eventName: string;
    saasId?: string;
    userId?: string;
    country?: string;
    conversionSource?: string;
    payload?: any;
}) {
    const { tenantId, eventName, saasId, userId, country, conversionSource, payload } = params;

    // 1. Validation
    if (!tenantId) throw new Error("Tenant ID is required");
    if (!eventName) throw new Error("Event Name is required");

    // Defaults
    const validCountry = (['ES', 'MX', 'CO', 'AR', 'CL'].includes(country || '') ? country : 'OTHER') as GrowthCountryCode;
    const validSource = (['viral_24h', 'referral', 'direct'].includes(conversionSource || '') ? conversionSource : 'other') as GrowthConversionSource;

    // Calculate enriched fields
    const safePayload = (payload || {}) as GrowthEventPayload;
    const isFastConverter = !!safePayload.fast_converter; // Explicit flag or derived logic could go here
    const sessionLatency = typeof safePayload.session_latency === 'number' ? safePayload.session_latency : 0;

    const eventId = crypto.randomUUID();

    // 2. Persist to D1
    const d1 = getDb();
    if (!d1) {
        console.warn(`[GROWTH_INGEST] Database unavailable, cannot persist event ${eventName}`);
        return { success: false, error: "Database unavailable" };
    }

    try {
        await d1.prepare(`
      INSERT INTO saas_growth_events (
        id, tenant_id, saas_id, user_id, 
        event_name, conversion_source, country, 
        payload, is_fast_converter, session_latency
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
            eventId,
            tenantId,
            saasId || null,
            userId || null,
            eventName,
            validSource,
            validCountry,
            JSON.stringify(safePayload),
            isFastConverter ? 1 : 0,
            sessionLatency
        ).run();

        console.log(`[GROWTH_INGEST] OK ${eventName} (${tenantId})`);
        return { success: true, eventId };

    } catch (error) {
        console.error(`[GROWTH_INGEST] ERROR ${eventName} (${tenantId})`, error);
        // decide if rethrow or swallow. For analytics, often swallow to not break user flow.
        // But for "Factory" we want to know execution errors.
        throw error;
    }
}
