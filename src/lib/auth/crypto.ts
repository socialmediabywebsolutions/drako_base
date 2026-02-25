/**
 * Steel Hardened Crypto Utilities
 * PBKDF2-SHA256 Implementation for Cloudflare Edge Runtime
 */

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
            iterations: 100000, // Reduced for Cloudflare Workers CPU limits
            hash: "SHA-256",
        },
        key,
        256
    );
    return {
        hash: btoa(String.fromCharCode(...new Uint8Array(bits))),
        salt: btoa(String.fromCharCode(...salt)),
        iterations: 100000,
    };
}

export async function verifyPassword(password: string, storedHash: string, storedSalt: string, storedIterations: number): Promise<boolean> {
    const salt = Uint8Array.from(atob(storedSalt), c => c.charCodeAt(0));
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
            iterations: storedIterations,
            hash: "SHA-256",
        },
        key,
        256
    );
    const computedHash = btoa(String.fromCharCode(...new Uint8Array(bits)));
    return computedHash === storedHash;
}
