import Stripe from 'stripe';

let stripeInstance: Stripe | null = null;

export const getStripe = () => {
    if (stripeInstance) return stripeInstance;

    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
        throw new Error("STRIPE_SECRET_KEY is not configured");
    }

    stripeInstance = new Stripe(apiKey, {
        apiVersion: '2025-12-15.clover' as any,
        typescript: true,
    });

    return stripeInstance;
};

// Keep the export for compatibility if needed, but safer to use getStripe()
export const stripe = {} as Stripe; // Placeholder if absolutely needed for types, but we should refactor usage.
