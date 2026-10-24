/**
 * whatsapp-channel/src/security.ts
 *
 * CHANNEL LAYER — fully reusable, zero domain coupling.
 *
 * Provides:
 *   verifyHmacSha256  — validate Meta's X-Hub-Signature-256 header
 *   isPhoneAllowed    — allowlist enforcement
 *
 * Both functions are pure (no side effects, no env reads) so they can be
 * unit-tested without a Worker runtime.
 */

/**
 * Verifies a Meta webhook HMAC-SHA256 signature.
 *
 * @param appSecret   The Meta App Secret (WHATSAPP_APP_SECRET env var)
 * @param rawBody     The raw request body string (must be read before JSON parsing)
 * @param signature   The value of the X-Hub-Signature-256 header (format: "sha256=<hex>")
 * @returns true if the signature is valid
 */
export async function verifyHmacSha256(
  appSecret: string,
  rawBody: string,
  signature: string,
): Promise<boolean> {
  if (!signature) return false;

  const expected = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  const encoder = new TextEncoder();

  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    return false;
  }

  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const computed = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computed === expected;
}

/**
 * Checks whether a phone number is in the configured allowlist.
 *
 * @param phone             E.164 phone number from the inbound message
 * @param allowedPhonesEnv  Comma-separated list from ALLOWED_PHONES env var
 *                          If empty or absent: returns true (open mode)
 *                          In production: always configure an explicit list
 * @returns true if the phone is allowed
 */
export function isPhoneAllowed(phone: string, allowedPhonesEnv?: string): boolean {
  if (!allowedPhonesEnv || allowedPhonesEnv.trim() === "") return true;
  const allowed = allowedPhonesEnv
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return allowed.includes(phone);
}
