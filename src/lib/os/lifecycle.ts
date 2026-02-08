import { run, queryOne, queryAll } from "@/lib/db";

export type LifecycleStatus = 'active' | 'past_due' | 'paused' | 'archived' | 'provisioning';

export interface EconomicEventPayload {
    tenantId: string;
    saasId: string;
    eventType: string;
    severity?: 'info' | 'warn' | 'error' | 'critical';
    message: string;
    amountMajor?: number;
    currency?: string;
    metadata?: Record<string, any>;
}

/**
 * Registra un evento económico o de ciclo de vida en el audit log.
 * Idempotencia manejada via metadata.id o similar si es necesario, 
 * pero aquí solo insertamos.
 */
export async function writeEconomicEvent(payload: EconomicEventPayload) {
    const id = globalThis.crypto?.randomUUID?.() ?? `eco_${Date.now()}`;
    await run(
        `INSERT INTO economic_events (
      id, saas_id, tenant_id, event_type, severity, message, 
      amount_major, currency, metadata_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        id,
        payload.saasId,
        payload.tenantId,
        payload.eventType,
        payload.severity ?? 'info',
        payload.message,
        payload.amountMajor ?? null,
        payload.currency ?? 'EUR',
        payload.metadata ? JSON.stringify(payload.metadata) : null
    );
}

/**
 * Transición a PAST_DUE
 * Se llama cuando falla el pago de una factura (invoice.payment_failed).
 * Solo si no estaba ya en past_due/paused/archived.
 */
export async function transitionToPastDue(saasId: string, reason: string, stripeEventId: string) {
    const saas = await queryOne<{ id: string; tenant_id: string; lifecycle_status: string }>(
        "SELECT id, tenant_id, lifecycle_status FROM saas_instances WHERE id = ?",
        saasId
    );
    if (!saas) return;

    if (['past_due', 'paused', 'archived'].includes(saas.lifecycle_status)) {
        // Ya está en un estado de deuda o peor, no reseteamos el contador
        return;
    }

    await run(
        `UPDATE saas_instances 
     SET lifecycle_status = 'past_due', 
         past_due_since = datetime('now'),
         stripe_status = 'past_due'
     WHERE id = ?`,
        saasId
    );

    await writeEconomicEvent({
        tenantId: saas.tenant_id,
        saasId: saas.id,
        eventType: 'lifecycle_change',
        severity: 'warn',
        message: `SaaS transitioned to PAST_DUE. Reason: ${reason}`,
        metadata: { from: saas.lifecycle_status, to: 'past_due', stripeEventId }
    });
}

/**
 * Auto-Pause si se excede el grace period (7 días).
 * Se llama desde el cron overseer.
 */
export async function autoPauseIfPastDueExceeded(saasId: string, now: Date = new Date()) {
    const saas = await queryOne<{
        id: string;
        tenant_id: string;
        lifecycle_status: string;
        past_due_since: string
    }>(
        "SELECT id, tenant_id, lifecycle_status, past_due_since FROM saas_instances WHERE id = ?",
        saasId
    );

    if (!saas || saas.lifecycle_status !== 'past_due' || !saas.past_due_since) return;

    const pastDueDate = new Date(saas.past_due_since);
    const diffMs = now.getTime() - pastDueDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays >= 7) {
        await run(
            `UPDATE saas_instances 
       SET lifecycle_status = 'paused', 
           paused_at = datetime('now')
       WHERE id = ?`,
            saasId
        );

        await writeEconomicEvent({
            tenantId: saas.tenant_id,
            saasId: saas.id,
            eventType: 'lifecycle_change',
            severity: 'error',
            message: `SaaS Auto-PAUSED. Grace period exceeded (${Math.floor(diffDays)} days).`,
            metadata: { from: 'past_due', to: 'paused', pastDueSince: saas.past_due_since }
        });
    }
}

/**
 * Reactivación a ACTIVE
 * Se llama cuando el pago tiene éxito (invoice.payment_succeeded) 
 * o se recupera la suscripción (customer.subscription.updated -> active).
 */
export async function resumeToActive(saasId: string, stripeEventId: string) {
    const saas = await queryOne<{ id: string; tenant_id: string; lifecycle_status: string }>(
        "SELECT id, tenant_id, lifecycle_status FROM saas_instances WHERE id = ?",
        saasId
    );
    if (!saas) return;

    if (saas.lifecycle_status === 'active') return; // Ya activo

    await run(
        `UPDATE saas_instances 
     SET lifecycle_status = 'active', 
         stripe_status = 'active',
         past_due_since = NULL,
         paused_at = NULL
     WHERE id = ?`,
        saasId
    );

    await writeEconomicEvent({
        tenantId: saas.tenant_id,
        saasId: saas.id,
        eventType: 'lifecycle_change',
        severity: 'info',
        message: `SaaS Resumed to ACTIVE. Payment recovered.`,
        metadata: { from: saas.lifecycle_status, to: 'active', stripeEventId }
    });
}

/**
 * Archivo final
 * Se llama manualmente o por regla de negocio estricta (e.g. 90 dias impago).
 * O si se cancela la suscripción explícitamente.
 */
export async function archiveSaaS(saasId: string, reason: string) {
    const saas = await queryOne<{ id: string; tenant_id: string; lifecycle_status: string }>(
        "SELECT id, tenant_id, lifecycle_status FROM saas_instances WHERE id = ?",
        saasId
    );
    if (!saas) return;

    // Calcular fecha de retención (30 días)
    const now = new Date();
    const retentionDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await run(
        `UPDATE saas_instances 
         SET lifecycle_status = 'archived', 
             archived_at = ?,
             retention_until = ?,
             stripe_status = 'canceled'
         WHERE id = ?`,
        now.toISOString(),
        retentionDate.toISOString(),
        saasId
    );

    await writeEconomicEvent({
        tenantId: saas.tenant_id,
        saasId: saas.id,
        eventType: 'lifecycle_change',
        severity: 'warn',
        message: `SaaS ARCHIVED. Reason: ${reason}. Retention until ${retentionDate.toISOString()}`,
        metadata: { from: saas.lifecycle_status, to: 'archived' }
    });
}
