import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Drako Systems - Strict Environment Validation
 * 
 * Ensures all required environment variables are present at runtime.
 * Throws immediately if a critical variable is missing.
 */

// Define strict types for Env
export interface DrakoStrictEnv {
    // Database
    DRACO_DB: boolean; // We don't export the object here to avoid circular dep, just check existence

    // Auth
    NEXTAUTH_SECRET: string;
    NEXTAUTH_URL?: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    INTERNAL_API_SECRET?: string;

    // Admin
    ADMIN_EMAIL?: string;

    // Stripe
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;

    // AI
    FIREWORKS_API_KEY?: string;
}

// Helper to get raw env from either Cloudflare or Node
function getRawEnv(): Record<string, unknown> {
    try {
        const ctx = getCloudflareContext();
        if (ctx?.env) return ctx.env as Record<string, unknown>;
    } catch { }

    if (typeof process !== "undefined" && process.env) {
        return process.env;
    }

    return {};
}

export function requireEnv(key: string): string {
    const raw = getRawEnv();
    const val = raw[key];
    if (typeof val === "string" && val.length > 0) return val;

    // Allow empty string if explicitly allowed? No, requireEnv implies required.
    throw new Error(`MISSING_ENV: ${key} is required but missing or empty.`);
}

export function getEnv(key: string, defaultValue: string = ""): string {
    const raw = getRawEnv();
    const val = raw[key];
    if (typeof val === "string") return val;
    return defaultValue;
}

export const safeEnv = {
    get NEXTAUTH_SECRET() { return requireEnv("NEXTAUTH_SECRET"); },
    get GOOGLE_CLIENT_ID() { return requireEnv("GOOGLE_CLIENT_ID"); },
    get GOOGLE_CLIENT_SECRET() { return requireEnv("GOOGLE_CLIENT_SECRET"); },
    get NEXTAUTH_URL() { return getEnv("NEXTAUTH_URL", "http://localhost:3000"); },
    get INTERNAL_API_URL() { return getEnv("INTERNAL_API_URL", "http://localhost:3000"); },
    get INTERNAL_API_SECRET() { return getEnv("INTERNAL_API_SECRET"); },

    // Stripe (Optional in some contexts, but let's be strict if accessed)
    get STRIPE_SECRET_KEY() { return requireEnv("STRIPE_SECRET_KEY"); },
    get STRIPE_WEBHOOK_SECRET() { return requireEnv("STRIPE_WEBHOOK_SECRET"); },

    get isDev() {
        return process.env.NODE_ENV === "development";
    },

    get isProduction() {
        return process.env.NODE_ENV === "production";
    }
};
