import { env } from "@/lib/cf";

const ENCRYPTION_VERSION = "v1";
const ENCRYPTION_ALGORITHM = "aes-gcm";
const ENCRYPTION_PREFIX = "encrypted";

export class TokenEncryptionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "TokenEncryptionError";
  }
}

function base64Encode(buffer: ArrayBuffer): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64");
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Decode(base64: string): ArrayBuffer {
  if (typeof Buffer !== "undefined") {
    const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function getPrimaryEncryptionSecret(): string {
  const secret = env()?.SOCIALFLOW_TOKEN_ENCRYPTION_SECRET?.trim();

  if (!secret) {
    throw new TokenEncryptionError(
      "SOCIALFLOW_TOKEN_ENCRYPTION_SECRET is not configured.",
      "ENCRYPTION_SECRET_MISSING",
    );
  }
  if (secret.length < 32) {
    throw new TokenEncryptionError(
      "SOCIALFLOW_TOKEN_ENCRYPTION_SECRET must be at least 32 characters long.",
      "ENCRYPTION_SECRET_TOO_SHORT",
    );
  }

  return secret;
}

function getNextEncryptionSecret(): string {
  const secret = env()?.SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT?.trim();

  if (!secret) {
    throw new TokenEncryptionError(
      "SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT is not configured.",
      "ENCRYPTION_NEXT_SECRET_MISSING",
    );
  }
  if (secret.length < 32) {
    throw new TokenEncryptionError(
      "SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT must be at least 32 characters long.",
      "ENCRYPTION_NEXT_SECRET_TOO_SHORT",
    );
  }

  return secret;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) {
    throw new TokenEncryptionError(
      "WebCrypto subtle API is unavailable.",
      "WEBCRYPTO_UNAVAILABLE",
    );
  }
  const encoder = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  );

  return globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("socialflow-token-encryption-salt-v1"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function isEncryptedToken(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith(`${ENCRYPTION_PREFIX}:${ENCRYPTION_VERSION}:${ENCRYPTION_ALGORITHM}:`);
}

export async function encryptToken(plaintext: string | null | undefined): Promise<string | null> {
  if (!plaintext) return null;

  try {
    const secret = getPrimaryEncryptionSecret();
    const key = await deriveKey(secret);
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      data,
    );
    return `${ENCRYPTION_PREFIX}:${ENCRYPTION_VERSION}:${ENCRYPTION_ALGORITHM}:${base64Encode(iv.buffer)}:${base64Encode(ciphertext)}`;
  } catch (error) {
    if (error instanceof TokenEncryptionError) throw error;
    throw new TokenEncryptionError(
      `Token encryption failed: ${error instanceof Error ? error.message : String(error)}`,
      "ENCRYPTION_FAILED",
    );
  }
}

export async function encryptTokenWithNext(plaintext: string | null | undefined): Promise<string | null> {
  if (!plaintext) return null;

  try {
    const secret = getNextEncryptionSecret();
    const key = await deriveKey(secret);
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      data,
    );
    return `${ENCRYPTION_PREFIX}:${ENCRYPTION_VERSION}:${ENCRYPTION_ALGORITHM}:${base64Encode(iv.buffer)}:${base64Encode(ciphertext)}`;
  } catch (error) {
    if (error instanceof TokenEncryptionError) throw error;
    throw new TokenEncryptionError(
      `Token encryption failed: ${error instanceof Error ? error.message : String(error)}`,
      "ENCRYPTION_FAILED",
    );
  }
}

type DecryptTokenOptions = {
  allowNextFallback?: boolean;
};

export async function decryptToken(
  value: string | null | undefined,
  options?: DecryptTokenOptions,
): Promise<string | null> {
  if (!value) return null;
  if (!value.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return value;
  }

  try {
    const parts = value.split(":");
    if (parts.length !== 5) {
      throw new TokenEncryptionError("Invalid encrypted token format.", "INVALID_FORMAT");
    }
    const [prefix, version, algorithm, ivBase64, ciphertextBase64] = parts;
    if (prefix !== ENCRYPTION_PREFIX) {
      throw new TokenEncryptionError("Invalid encrypted token prefix.", "INVALID_PREFIX");
    }
    if (version !== ENCRYPTION_VERSION) {
      throw new TokenEncryptionError("Unsupported encryption version.", "UNSUPPORTED_VERSION");
    }
    if (algorithm !== ENCRYPTION_ALGORITHM) {
      throw new TokenEncryptionError("Unsupported encryption algorithm.", "UNSUPPORTED_ALGORITHM");
    }

    const secret = getPrimaryEncryptionSecret();
    const key = await deriveKey(secret);
    const iv = base64Decode(ivBase64);
    const ciphertext = base64Decode(ciphertextBase64);

    let plaintext: ArrayBuffer;
    try {
      plaintext = await globalThis.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertext,
      );
    } catch (error) {
      const allowNextFallback = options?.allowNextFallback ?? true;
      if (!allowNextFallback || !isNextEncryptionAvailable()) {
        throw error;
      }

      const nextSecret = getNextEncryptionSecret();
      const nextKey = await deriveKey(nextSecret);
      plaintext = await globalThis.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        nextKey,
        ciphertext,
      );
    }
    return new TextDecoder().decode(plaintext);
  } catch (error) {
    if (error instanceof TokenEncryptionError) throw error;
    throw new TokenEncryptionError(
      `Token decryption failed: ${error instanceof Error ? error.message : String(error)}`,
      "DECRYPTION_FAILED",
    );
  }
}

export async function reencryptTokenWithNext(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (!value.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return encryptTokenWithNext(value);
  }

  const plaintext = await decryptToken(value, { allowNextFallback: false });
  if (!plaintext) return null;
  return encryptTokenWithNext(plaintext);
}

export function isNextEncryptionAvailable(): boolean {
  try {
    const secret = env()?.SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT?.trim();
    return Boolean(secret && secret.length >= 32);
  } catch {
    return false;
  }
}
