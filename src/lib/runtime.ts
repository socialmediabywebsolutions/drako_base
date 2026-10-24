/**
 * Runtime Detection Utilities - OLIMPO Edition
 * 
 * Pure, lightweight functions to detect execution environment.
 * NO imports from Cloudflare, DB, or heavy SDKs.
 * Used by middleware and core infrastructure for fail-safe behavior.
 */

/**
 * Detect if running on Vercel platform
 */
export function isVercel(): boolean {
    if (typeof process === "undefined") return false;
    return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_URL);
}

/**
 * Detect if running on Cloudflare (Pages or Workers)
 */
export function isCloudflare(): boolean {
    if (typeof process === "undefined") return true; // Edge runtime, likely Cloudflare
    return Boolean(
        process.env.CF_PAGES === "1" ||
        process.env.CF_PAGES_ENVIRONMENT ||
        process.env.CF_PAGES_BRANCH ||
        process.env.CLOUDFLARE_ACCOUNT_ID
    );
}

/**
 * Detect if running in Edge runtime (vs Node.js runtime)
 */
export function isEdgeRuntime(): boolean {
    if (typeof process === "undefined") return true;
    return process.env.NEXT_RUNTIME === "edge";
}

/**
 * Get environment name for logging/debugging
 */
export function getEnvironmentName(): "vercel" | "cloudflare" | "development" | "unknown" {
    if (isVercel()) return "vercel";
    if (isCloudflare()) return "cloudflare";
    if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
        return "development";
    }
    return "unknown";
}

/**
 * Get runtime name for logging/debugging
 */
export function getRuntimeName(): "edge" | "nodejs" | "unknown" {
    if (isEdgeRuntime()) return "edge";
    if (typeof process !== "undefined") return "nodejs";
    return "unknown";
}
