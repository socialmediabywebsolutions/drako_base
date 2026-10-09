// Copia literal de src/lib/auth/crypto.ts (PBKDF2-SHA256). No cambiar parámetros: las
// credenciales existentes en socialflow_credentials se verifican con este código.
/**
 * Steel Hardened Crypto Utilities (Edge Native)
 * PBKDF2-SHA256 Implementation for Cloudflare Edge Runtime
 * ---------------------------------------------------------
 * No Node.js dependencies (no Buffer, no process.env).
 */

const ITERATIONS = 100000; // Optimal for Cloudflare Workers CPU limit (50ms)

/**
 * Native Helpers for Base64 (avoiding Buffer)
 */
function bytesToBase64(bytes: Uint8Array): string {
    const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
    return btoa(binString);
}

function base64ToBytes(base64: string): Uint8Array {
    const binString = atob(base64);
    return Uint8Array.from(binString, (m) => m.charCodeAt(0));
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string; iterations: number }> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt,
            iterations: ITERATIONS,
            hash: "SHA-256",
        },
        key,
        256
    );

    return {
        hash: bytesToBase64(new Uint8Array(bits)),
        salt: bytesToBase64(salt),
        iterations: ITERATIONS,
    };
}

export async function verifyPassword(password: string, storedHash: string, storedSalt: string, storedIterations: number): Promise<boolean> {
    const salt = base64ToBytes(storedSalt);
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: new Uint8Array(salt),
            iterations: storedIterations,
            hash: "SHA-256",
        },
        key,
        256
    );

    const computedHash = bytesToBase64(new Uint8Array(bits));

    // Constant-time comparison is not natively available in SubtleCrypto for raw strings,
    // but comparing the computed base64 strings is the standard approach here.
    return computedHash === storedHash;
}
