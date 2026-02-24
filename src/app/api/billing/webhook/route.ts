
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { env } from "@/lib/cf";
import { type ProvisioningEvent } from "@/lib/billing/provisioning_workflow";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const bindings = env();
    if (!bindings?.STRIPE_SECRET_KEY || !bindings?.STRIPE_WEBHOOK_SECRET) {
        console.error("Missing Stripe Configuration");
        return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
    }

    const stripe = new Stripe(bindings.STRIPE_SECRET_KEY, { apiVersion: "2024-12-18.acacia" as any });
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
        return NextResponse.json({ error: "Missing Signature" }, { status: 400 });
    }

    try {
        const bodyText = await req.text();
        const event = stripe.webhooks.constructEvent(
            bodyText,
            signature,
            bindings.STRIPE_WEBHOOK_SECRET
        );

        console.log(`[Webhook] Received Stripe Event: ${event.type} (${event.id})`);


        // 1. Extract SaaS Slug (Routing)
        const dataObj = event.data.object as any;
        const metadata = dataObj.metadata || {};

        // FAIL CLOSED: No saas_slug = Audit Critical + 400
        const saasSlug = metadata.saas_slug;

        if (!saasSlug) {
            console.error(`[Webhook] CRITICAL: Missing saas_slug in metadata for event ${event.id}`);
            // In a real scenario, valid Stripe signature but invalid metadata means configuration error/attack.
            // We return 400 to signal error to Stripe (it will retry, but we want to alert).
            return NextResponse.json({ error: "Missing saas_slug metadata" }, { status: 400 });
        }

        console.log(`[Webhook] Routing for SaaS: ${saasSlug}`);

        // 2. Construct Standard Provisioning Event
        let provisioningEvent: ProvisioningEvent | null = null;

        // Map relevant events
        if (event.type === 'checkout.session.completed') {
            // For checkout session, we might need to fetch subscription to get dates, 
            // but usually we rely on subsequent 'customer.subscription.created' event for full details.
            // However, to be robust, we accept what we have.
            provisioningEvent = {
                eventId: event.id,
                type: 'checkout.session.completed',
                data: {
                    stripeCustomerId: dataObj.customer as string,
                    stripeSubscriptionId: dataObj.subscription as string,
                    stripePriceId: dataObj.metadata?.price_id || dataObj.line_items?.data?.[0]?.price?.id,
                    customerEmail: dataObj.customer_details?.email || dataObj.email,
                    saasSlug: saasSlug,
                    tenantId: metadata.tenant_id,
                    planCode: metadata.plan_code,
                    tenantName: metadata.tenant_name
                }
            };
        } else if (['invoice.payment_failed', 'invoice.payment_succeeded', 'customer.subscription.deleted', 'customer.subscription.updated', 'customer.subscription.created'].includes(event.type)) {
            const subData = event.type.startsWith('customer.subscription') ? dataObj : null;

            provisioningEvent = {
                eventId: event.id,
                type: event.type as any,
                data: {
                    stripeCustomerId: dataObj.customer as string,
                    stripeSubscriptionId: dataObj.subscription || dataObj.id,
                    stripePriceId: dataObj.items?.data?.[0]?.price?.id,
                    customerEmail: dataObj.email,
                    saasSlug: saasSlug,
                    tenantId: metadata?.tenant_id, // Might be on subscription metadata
                    planCode: metadata?.plan_code,
                    currentPeriodStart: subData ? new Date(subData.current_period_start * 1000).toISOString() : undefined,
                    currentPeriodEnd: subData ? new Date(subData.current_period_end * 1000).toISOString() : undefined,
                    cancelAtPeriodEnd: subData ? subData.cancel_at_period_end : undefined
                }
            };
        }

        // 3. Enqueue if valid
        if (provisioningEvent) {
            // @ts-expect-error - Stripe event type mismatch known issue
            const queue = bindings.BILLING_QUEUE;
            if (queue) {
                await queue.send(provisioningEvent);
                console.log(`[Webhook] Enqueued event ${event.id} to ${saasSlug}`);
            } else {
                console.error("[Webhook] BILLING_QUEUE binding missing!");
                // We return 500 to retry webhook
                return NextResponse.json({ error: "Queue Unavailable" }, { status: 500 });
            }
        } else {
            console.log(`[Webhook] Ignored event type: ${event.type}`);
        }

        return NextResponse.json({ received: true });

    } catch (err) {
        console.error(`[Webhook] Error: ${(err as Error).message}`);
        return NextResponse.json({ error: `Webhook Error: ${(err as Error).message}` }, { status: 400 });
    }
}
