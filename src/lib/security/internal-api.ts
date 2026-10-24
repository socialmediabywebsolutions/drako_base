export class SecurityError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SecurityError';
    }
}

/**
 * Generates headers for Internal API calls.
 * Implements Phase 3.1 Hardening: Anti-Replay & HMAC Signature.
 */
export async function signRequest(
    payload: string | null,
    secret: string
): Promise<{ 'x-drako-ts': string; 'x-drako-nonce': string; 'x-drako-sig': string }> {
    const ts = Date.now().toString();
    const nonce = crypto.randomUUID();
    const bodyHash = payload || ''; // Simplify: In prod use proper body hashing if body is large, but for JSON payloads raw string is fine.

    // Sign: ts.nonce.body
    const data = `${ts}.${nonce}.${bodyHash}`;
    const sig = await hmacSha256(secret, data);

    return {
        'x-drako-ts': ts,
        'x-drako-nonce': nonce,
        'x-drako-sig': sig
    };
}

/**
 * Verifies headers from Internal API calls.
 */
export async function verifyRequest(
    request: Request,
    secret: string,
    checkNonce?: (nonce: string) => Promise<boolean>
): Promise<void> {
    const ts = request.headers.get('x-drako-ts');
    const nonce = request.headers.get('x-drako-nonce');
    const sig = request.headers.get('x-drako-sig');

    if (!ts || !nonce || !sig) {
        throw new SecurityError('Missing signature headers');
    }

    // 1. Replay Attack: Timestamp Window (e.g. 60 seconds)
    const now = Date.now();
    const reqTime = parseInt(ts, 10);
    if (Math.abs(now - reqTime) > 60 * 1000) {
        throw new SecurityError('Request timestamp expired');
    }

    // 2. Signature Check
    // We need the raw body to verify.
    // If we consume the body here, we must clone the request or ensure caller passed body text.
    // Since Request body can be read once, we assume caller handles this or we clone.
    const requestClone = request.clone();
    const bodyText = await requestClone.text();
    const bodyHash = bodyText || '';

    const data = `${ts}.${nonce}.${bodyHash}`;
    const expectedSig = await hmacSha256(secret, data);

    if (sig !== expectedSig) {
        throw new SecurityError('Invalid signature');
    }

    // 3. Nonce Check
    if (checkNonce) {
        const isValid = await checkNonce(nonce);
        if (!isValid) {
            throw new SecurityError('Nonce rejection (Replay)');
        }
    }
}

async function hmacSha256(secret: string, data: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        enc.encode(data)
    );
    return bufferToHex(signature);
}

function bufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
