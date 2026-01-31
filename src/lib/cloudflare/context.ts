/**
 * Cloudflare Context Helper for OpenNext
 * 
 * Provides unified access to Cloudflare bindings (D1, KV, R2, etc.)
 * using OpenNext's getCloudflareContext() instead of @cloudflare/next-on-pages
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

export type CloudflareEnv = {
    DB: D1Database;
    KV: KVNamespace;
    R2: R2Bucket;
    // Add other bindings as needed
};

/**
 * Get Cloudflare environment bindings and context
 * Compatible with OpenNext Cloudflare adapter
 */
export function getCloudflareEnv(): CloudflareEnv {
    const context = getCloudflareContext();
    return context.env as CloudflareEnv;
}

/**
 * Get full Cloudflare context (env + ctx)
 */
export function getFullCloudflareContext() {
    return getCloudflareContext();
}
