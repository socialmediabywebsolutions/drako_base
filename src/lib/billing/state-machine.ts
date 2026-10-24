
export type SubscriptionState = "trial" | "active" | "past_due" | "unpaid" | "canceled";

export function getSubscriptionBehavior(state: SubscriptionState) {
    switch (state) {
        case "trial":
        case "active":
            return { canAccess: true, warning: false };
        case "past_due":
            return { canAccess: true, warning: true };
        case "unpaid":
        case "canceled":
        default:
            return { canAccess: false, warning: false };
    }
}

export function mapStripeEventToStatus(eventType: string): SubscriptionState | null {
    switch (eventType) {
        case "checkout.session.completed":
        case "invoice.payment_succeeded":
        case "customer.subscription.created":
        case "customer.subscription.updated": // Need to check status inside
            return "active";
        case "invoice.payment_failed":
            return "past_due";
        case "customer.subscription.deleted":
            return "canceled";
        // For manual 'unpaid' transition, usually comes from strict internal logic or specific Stripe 'unpaid' status
        default:
            return null;
    }
}
