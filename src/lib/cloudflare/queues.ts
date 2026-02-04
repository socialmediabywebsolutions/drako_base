import { normalizeCorrelationId } from "../correlation";

/**
 * Drako-Forge Steel v1.0.1 - Queues v1 Contract
 */

export interface QueueMessageV1<T = any> {
    v: 1;
    correlationId: string;
    tenantId?: string;
    saasId?: string;
    type: string;
    idempotencyKey: string;
    createdAt: string;
    data: T;
}

/**
 * Builds a Steel v1.0.1 compliant queue message.
 */
export function buildQueueMessage<T>(params: {
    type: string;
    data: T;
    correlationId: string;
    tenantId?: string;
    saasId?: string;
}): QueueMessageV1<T> {
    const normalizedId = normalizeCorrelationId(params.correlationId);

    // IdempotencyKey = hash(type + tenantId + payload fingerprint)
    // For now using a simple string concatenation as a key, 
    // in production this should be a proper hash.
    const fingerprint = JSON.stringify(params.data).slice(0, 100);
    const idempotencyKey = `${params.type}:${params.tenantId || 'global'}:${fingerprint}`;

    return {
        v: 1,
        correlationId: normalizedId,
        tenantId: params.tenantId,
        saasId: params.saasId,
        type: params.type,
        idempotencyKey,
        createdAt: new Date().toISOString(),
        data: params.data,
    };
}

/**
 * Error envelope for Dead Letter Queues (DLQ)
 */
export interface DlqEnvelope<T> {
    originalMessage: QueueMessageV1<T>;
    error: {
        message: string;
        stack?: string;
        code?: string;
        failedAt: string;
    };
}

export function wrapForDlq<T>(
    message: QueueMessageV1<T>,
    error: Error,
    code?: string
): DlqEnvelope<T> {
    return {
        originalMessage: message,
        error: {
            message: error.message,
            stack: error.stack,
            code,
            failedAt: new Date().toISOString(),
        },
    };
}
