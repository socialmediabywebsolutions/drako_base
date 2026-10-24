/**
 * Cloudflare Context Helper for OpenNext
 * 
 * Provides unified access to Cloudflare bindings (D1, KV, R2, etc.)
 * using OpenNext's getCloudflareContext() instead of @cloudflare/next-on-pages
 */
import { getCloudflareContextSafeSync, isBuildPhase } from "@/lib/cloudflare/runtime";

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
    if (isBuildPhase()) {
        return {
            DB: null,
            KV: null,
            R2: null,
        };
    }

    const context = getCloudflareContextSafeSync() as { env?: unknown } | null;
    if (context && context.env && typeof context.env === "object") {
        return context.env as CloudflareEnv;
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
    if (isBuildPhase()) {
        return null;
    }

    return getCloudflareContextSafeSync();
}
