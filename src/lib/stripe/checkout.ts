import { stripe } from "./server";
import { PackName, STRIPE_PRICE_MAP } from "@/lib/subscriptions";

export async function createCheckoutSession({
    tenantId,
    saasId,
    packName,
    email,
    returnUrl,
}: {
    tenantId: string;
    saasId: string;
    packName: PackName;
    email?: string;
    returnUrl: string;
}) {
    const priceId = STRIPE_PRICE_MAP[packName];

    if (!priceId) {
        throw new Error(`No price configured for pack: ${packName}`);
    }

    const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [
            {
                price: priceId,
                quantity: 1,
            },
        ],
        customer_email: email,
        metadata: {
            tenantId,
            saasId,
            packName,
        },
        success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnUrl}?canceled=true`,
        subscription_data: {
            metadata: {
                tenantId,
                saasId,
            }
        }
    });

    return { url: session.url, sessionId: session.id };
}
