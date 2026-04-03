
import { type MessageBatch, type Queue } from "@cloudflare/workers-types";
import { setGlobalEnv, type DracoEnv } from "@/lib/cf";
import { provisionTenantFromStripe, type ProvisioningEvent } from "@/lib/billing/provisioning_workflow";
import { queryOne } from "@/lib/db";
import { writeBillingAuditLog } from "@/lib/billing/billing-audit";
import { updateCanonicalSubscriptionLifecycleState } from "@/lib/billing/subscriptions";

export interface Env extends DracoEnv {
    BILLING_QUEUE: Queue<ProvisioningEvent>;
}

export default {
    async queue(batch: MessageBatch<ProvisioningEvent>, env: Env): Promise<void> {
        setGlobalEnv(env);
        console.log(`[BillingWorker] Processing batch of ${batch.messages.length} messages`);

        for (const message of batch.messages) {
            try {
                const event = message.body;
                console.log(`[BillingWorker] Processing event ${event.eventId} (${event.type}) for SaaS: ${event.data.saasSlug}`);
                const existingLog = await queryOne<{ id: string }>(
                    `SELECT id FROM billing_audit_logs WHERE stripe_event_id = ?`,
                    event.eventId
                );

                if (existingLog) {
                    console.log(`[BillingWorker] Skipped duplicate event ${event.eventId}`);
                    message.ack();
                    continue;
                }

                if (event.type === 'checkout.session.completed') {
                    const result = await provisionTenantFromStripe(event);
                    if (!result.success) {
                        console.error(`[BillingWorker] Provisioning Failed: ${result.error}`);
                        message.retry();
                    } else {
                        // Log success happens inside provisionTenantFromStripe
                        // But we should verify it logs stripe_event_id too.
                        message.ack();
                    }
                } else {
                    await handleBillingEvent(event);
                    message.ack();
                }

            } catch (error) {
                console.error(`[BillingWorker] Error processing message ${message.id}`, error);
                message.retry();
            }
        }
    }
};

async function handleBillingEvent(event: ProvisioningEvent) {
    const { stripeSubscriptionId, saasSlug, currentPeriodEnd, cancelAtPeriodEnd } = event.data;
    let newStatus: string | null = null;

    switch (event.type) {
        case 'invoice.payment_failed': newStatus = 'past_due'; break;
        case 'invoice.payment_succeeded': newStatus = 'active'; break;
        case 'customer.subscription.deleted': newStatus = 'canceled'; break;
        case 'customer.subscription.updated': newStatus = 'active'; break; // Simplified
    }

    if (newStatus) {
        console.log(`[BillingWorker] Updating subscription ${stripeSubscriptionId} to ${newStatus}`);

        await updateCanonicalSubscriptionLifecycleState({
            stripeSubscriptionId,
            saasSlug,
            status: newStatus,
            currentPeriodEnd,
            cancelAtPeriodEnd: cancelAtPeriodEnd ?? null,
        });

        try {
            await writeBillingAuditLog({
                eventType: "billing_status_change",
                saasSlug,
                tenantId: "system",
                severity: "info",
                correlationId: event.eventId,
                stripeEventId: event.eventId,
                outcome: "processed",
                metadata: { newStatus, stripeSubscriptionId, eventType: event.type },
            });
        } catch (e) {
            console.warn("Failed to write audit log", e);
        }
    }
}
