// Copia de src/lib/correlation.ts para SocialCors (P5). El holding conserva el original; no se comparten módulos.
/**
 * Drako-Forge Steel v1.0.1 - Unified Observability Utility
 */

export const CORRELATION_HEADER = "x-drako-correlation-id";
export const TENANT_HEADER = "x-drako-tenant-id";
export const SAAS_HEADER = "x-drako-saas-id";
export const CORRELATION_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Generates a standard UUID v4 for correlation.
 */
export function generateCorrelationId(): string {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID().toLowerCase();
    }
    // Fallback for older environments
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    }).toLowerCase();
}

/**
 * Validates if a string is a valid UUID v4 (Standard Steel).
 */
export function isValidCorrelationId(id: string | null | undefined): id is string {
    if (!id) return false;
    return CORRELATION_ID_REGEX.test(id);
}

/**
 * Normalizes a correlation ID to lowercase.
 */
export function normalizeCorrelationId(id: string): string {
    return id.toLowerCase();
}

/**
 * Bypass rules for static assets and system protocols.
 */
export function shouldBypassCorrelation(pathname: string): boolean {
    // Static extensions
    const staticExtensions = /\.(js|css|png|jpg|jpeg|svg|ico|woff2|webp|gif|txt|xml)$/i;
    if (staticExtensions.test(pathname)) return true;

    // Well-known and system paths
    if (pathname.startsWith("/_next/")) return true;
    if (pathname.startsWith("/.well-known/")) return true;
    if (pathname === "/robots.txt") return true;
    if (pathname === "/sitemap.xml") return true;

    return false;
}
