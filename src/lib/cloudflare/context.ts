/**
 * Cloudflare Context Helper for OpenNext
 * 
 * Provides unified access to Cloudflare bindings (D1, KV, R2, etc.)
 * using OpenNext's getCloudflareContext() instead of @cloudflare/next-on-pages
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

export type CloudflareEnv = {
    DB: D1Database | null;
    KV: KVNamespace | null;
    R2: R2Bucket | null;
    // Add other bindings as needed
};

/**
 * OLIMPO: Get Cloudflare environment bindings and context
 * Compatible with OpenNext Cloudflare adapter  
 * Returns object with null bindings when not available (e.g., Vercel)
 */
export function getCloudflareEnv(): CloudflareEnv {
    try {
        const context = getCloudflareContext();
        if (context && context.env && typeof context.env === "object") {
            return context.env as CloudflareEnv;
        }
    } catch {
        // Cloudflare context not available (e.g., Vercel)
    }

    // Return object with null bindings for graceful degradation
    return {
        DB: null,
        KV: null,
        R2: null,
    };
}

/**
 * OLIMPO: Get full Cloudflare context (env + ctx)
 * Returns null when not available
 */
export function getFullCloudflareContext() {
    try {
        return getCloudflareContext();
    } catch {
        return null;
    }
}
