export type SubscriptionState =
    | 'trial'
    | 'active'
    | 'past_due'
    | 'unpaid'
    | 'canceled';

export interface SubscriptionBehavior {
    allowFeatures: boolean; // General feature access
    allowAICalls: boolean;  // Specific resource access
    allowWorkspaceCreation: boolean;
    mode: 'full' | 'read-only' | 'blocked';
}

// Strict behavior matrix definition
export const SUBSCRIPTION_BEHAVIORS: Record<SubscriptionState, SubscriptionBehavior> = {
    trial: {
        allowFeatures: true,
        allowAICalls: true,
        allowWorkspaceCreation: true,
        mode: 'full',
    },
    active: {
        allowFeatures: true,
        allowAICalls: true,
        allowWorkspaceCreation: true,
        mode: 'full',
    },
    past_due: {
        allowFeatures: true, // Grace period active
        allowAICalls: true,  // Service continues but warns
        allowWorkspaceCreation: false, // Prevent growth
        mode: 'full', // UI should show warnings
    },
    unpaid: {
        allowFeatures: false, // Hard block
        allowAICalls: false,  // Hard block
        allowWorkspaceCreation: false,
        mode: 'read-only', // Data visible but immutable
    },
    canceled: {
        allowFeatures: false,
        allowAICalls: false,
        allowWorkspaceCreation: false,
        mode: 'read-only',
    },
};

/**
 * Validates if a state transition is allowed in the lifecycle.
 * Enforces the directed graph: trial -> active -> past_due -> unpaid -> canceled
 */
export function validateTransition(from: SubscriptionState, to: SubscriptionState): boolean {
    if (from === to) return true;

    switch (from) {
        case 'trial':
            return to === 'active' || to === 'canceled';
        case 'active':
            return to === 'past_due' || to === 'canceled';
        case 'past_due':
            return to === 'active' || to === 'unpaid' || to === 'canceled';
        case 'unpaid':
            return to === 'active' || to === 'canceled'; // Can recover payment
        case 'canceled':
            return false; // Terminal state
        default:
            return false;
    }
}

/**
 * Returns the enforced behavior for a given state.
 * Implements "Fail Closed" by defaulting to blocked if state is invalid.
 */
export function getBehavior(state: string): SubscriptionBehavior {
    const behavior = SUBSCRIPTION_BEHAVIORS[state as SubscriptionState];
    if (!behavior) {
        console.error(`Invalid subscription state found: ${state}. Defaulting to BLOCKED.`);
        return {
            allowFeatures: false,
            allowAICalls: false,
            allowWorkspaceCreation: false,
            mode: 'blocked',
        };
    }
    return behavior;
}
