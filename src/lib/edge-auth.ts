/**
 * EDGE AUTH CORE v1.0
 * 
 * Purpose: Edge-compatible authentication utilities using Web Crypto API
 * Runtime: Cloudflare Workers / Edge Runtime
 * 
 * CRITICAL: No Node.js dependencies allowed in this module
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthsCookieName } from "@/lib/auths/cookies";
import { resolveAuthsContextFromHost } from "@/lib/auths/contexts";
import { verifyAuthsSessionToken } from "@/lib/auths/tokens";
import { isAuthsIsolationEnabled } from "@/lib/auths/flags";
import type { AuthsContext } from "@/lib/auths/types";

// ========================================
// SESSION INTERFACE
// ========================================

export interface EdgeSession {
    userId: string;
    email: string;
    tenantId: string;
    role: string;
    iat: number; // Issued at (timestamp)
    exp: number; // Expiration (timestamp)
}

// ========================================
// JWT UTILITIES - WEB CRYPTO API
// ========================================

/**
 * Sign a JWT payload using Web Crypto API (Edge-compatible)
 */
export async function signJwt(
    payload: EdgeSession,
    secret: string
): Promise<string> {
    const header = {
        alg: "HS256",
        typ: "JWT",
    };

    // Encode header and payload
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));

    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    // Convert secret to CryptoKey
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );

    // Sign
    const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(signatureInput)
    );

    const signature = base64UrlEncode(signatureBuffer);

    return `${signatureInput}.${signature}`;
}

/**
 * Verify and decode a JWT using Web Crypto API (Edge-compatible)
 */
export async function verifyJwt(
    token: string,
    secret: string
): Promise<EdgeSession | null> {
    try {
        const parts = token.split(".");
        if (parts.length !== 3) {
            return null;
        }

        const [encodedHeader, encodedPayload, signature] = parts;
        const signatureInput = `${encodedHeader}.${encodedPayload}`;

        // Convert secret to CryptoKey
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const key = await crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["verify"]
        );

        // Verify signature
        const signatureBuffer = base64UrlDecode(signature);
        const isValid = await crypto.subtle.verify(
            "HMAC",
            key,
            signatureBuffer as BufferSource,
            encoder.encode(signatureInput)
        );

        if (!isValid) {
            return null;
        }

        // Decode payload
        const payloadJson = base64UrlDecodeToString(encodedPayload);
        const payload = JSON.parse(payloadJson) as EdgeSession;

        // Check expiration
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
            return null; // Token expired
        }

        return payload;
    } catch (error) {
        console.error("JWT_VERIFICATION_FAILED", error);
        return null;
    }
}

// ========================================
// SESSION EXTRACTION
// ========================================

/**
 * Extract session from request (cookies or Authorization header)
 */
export async function extractSessionFromRequest(
    req: NextRequest,
    secret?: string
): Promise<EdgeSession | null> {
    const requestedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const context = resolveAuthsContextFromHost(requestedHost);

    if (isAuthsIsolationEnabled()) {
        const isolatedCookieName = getAuthsCookieName(context);
        const isolatedCookie = req.cookies.get(isolatedCookieName)?.value;
        if (isolatedCookie) {
            const claims = await verifyAuthsSessionToken(isolatedCookie, context);
            if (claims) {
                return {
                    userId: claims.sub,
                    email: claims.email,
                    tenantId: claims.tenantId,
                    role: claims.role,
                    iat: claims.iat,
                    exp: claims.exp,
                };
            }
            // Explicitly block invalid cookie from current context.
            return null;
        }

        // Explicit hard wall: if a foreign SaaS cookie is present, reject.
        const foreignContexts: AuthsContext[] = ["drakos", "mentorias", "bases"].filter((item) => item !== context) as AuthsContext[];
        for (const foreign of foreignContexts) {
            const foreignCookie = req.cookies.get(getAuthsCookieName(foreign))?.value;
            if (foreignCookie) return null;
        }

        // Do not accept legacy next-auth cookies or bearer tokens when isolation is enabled.
        return null;
    }

    const jwtSecret = secret || process.env.NEXTAUTH_SECRET;
    if (!jwtSecret) {
        console.error("NEXTAUTH_SECRET not configured");
        return null;
    }

    // Try cookie first (next-auth default)
    const sessionToken =
        req.cookies.get("next-auth.session-token")?.value ||
        req.cookies.get("__Secure-next-auth.session-token")?.value;

    if (sessionToken) {
        return await verifyJwt(sessionToken, jwtSecret);
    }

    // Try Authorization header (Bearer token)
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        return await verifyJwt(token, jwtSecret);
    }

    return null;
}

// ========================================
// COOKIE MANAGEMENT
// ========================================

/**
 * Set authentication cookie on response
 */
export function setAuthCookie(
    response: NextResponse,
    token: string,
    options?: {
        maxAge?: number; // seconds
        secure?: boolean;
        httpOnly?: boolean;
        sameSite?: "strict" | "lax" | "none";
    }
): NextResponse {
    const {
        maxAge = 30 * 24 * 60 * 60, // 30 days default
        secure = true,
        httpOnly = true,
        sameSite = "lax",
    } = options || {};

    response.cookies.set("next-auth.session-token", token, {
        httpOnly,
        secure,
        sameSite,
        maxAge,
        path: "/",
    });

    return response;
}

/**
 * Clear authentication cookie
 */
export function clearAuthCookie(response: NextResponse): NextResponse {
    response.cookies.delete("next-auth.session-token");
    response.cookies.delete("__Secure-next-auth.session-token");
    return response;
}

// ========================================
// BASE64URL HELPERS
// ========================================

function base64UrlEncode(input: string | ArrayBuffer): string {
    let base64: string;

    if (typeof input === "string") {
        base64 = btoa(input);
    } else {
        const bytes = new Uint8Array(input);
        const binary = Array.from(bytes)
            .map((byte) => String.fromCharCode(byte))
            .join("");
        base64 = btoa(binary);
    }

    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecode(input: string): Uint8Array {
    // Add padding
    let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
        base64 += "=";
    }

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function base64UrlDecodeToString(input: string): string {
    const bytes = base64UrlDecode(input);
    const decoder = new TextDecoder();
    return decoder.decode(bytes);
}
