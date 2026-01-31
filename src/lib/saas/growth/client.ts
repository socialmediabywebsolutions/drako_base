'use client';

// Define event types closely matching the backend expectations
export type GrowthEventInput = {
    tenantId: string;
    eventName:
    | 'mentoria.signup'
    | 'mentoria.first_session'
    | 'mentoria.badge_unlocked'
    | 'mentoria.converted'
    | 'mentoria.inactivity_3d'
    | string;
    saasId?: string;
    userId?: string;
    country?: string; // ES, MX, CO, AR, CL
    conversionSource?: string;
    payload?: Record<string, any>;
};

/**
 * Fire-and-forget tracking for Growth Intelligence.
 * Designed to never throw errors to the caller and minimally impact performance.
 */
export async function trackGrowthEventClient(event: GrowthEventInput) {
    if (typeof window === 'undefined') return; // Client-side only check (mostly)

    try {
        // 1. Fire non-blocking request
        // We use fetch with keepalive if possible to ensure it sends even if page unloads
        fetch('/api/saas/growth/track', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
            keepalive: true,
            cache: 'no-store'
        }).catch(err => {
            // Slient catch for network errors
            if (process.env.NODE_ENV === 'development') {
                console.warn('[Starting Growth Tracker] Network Error (Silent in Prod):', err);
            }
        });

    } catch (error) {
        // Failsafe catch
        if (process.env.NODE_ENV === 'development') {
            console.warn('[Starting Growth Tracker] Implementation Error:', error);
        }
    }
}
