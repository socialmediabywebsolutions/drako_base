/**
 * Token Encryption Utilities for SocialFlow Runtime
 * 
 * Provides AES-GCM encryption/decryption for sensitive OAuth tokens.
 * Designed for Cloudflare Workers using Web Crypto API.
 * 
 * Security: Tokens are encrypted at rest in D1. Encryption key is stored
 * as a Worker Secret (SOCIALFLOW_TOKEN_ENCRYPTION_SECRET).
 * 
 * Format: encrypted:v1:aes-gcm:<iv_base64>:<ciphertext_base64>
 */

import { getSocialFlowRuntimeEnv } from "../runtime-env";

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
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Decode(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getPrimaryEncryptionSecret(): string {
  const env = getSocialFlowRuntimeEnv();
  const secret = env?.SOCIALFLOW_TOKEN_ENCRYPTION_SECRET?.trim();
  
  if (!secret) {
    throw new TokenEncryptionError(
      "SOCIALFLOW_TOKEN_ENCRYPTION_SECRET is not configured. Cannot encrypt tokens.",
      "ENCRYPTION_SECRET_MISSING"
    );
  }
  
  if (secret.length < 32) {
    throw new TokenEncryptionError(
      "SOCIALFLOW_TOKEN_ENCRYPTION_SECRET must be at least 32 characters long.",
      "ENCRYPTION_SECRET_TOO_SHORT"
    );
  }
  
  return secret;
}

function getNextEncryptionSecret(): string {
  const env = getSocialFlowRuntimeEnv();
  const secret = env?.SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT?.trim();

  if (!secret) {
    throw new TokenEncryptionError(
      "SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT is not configured. Cannot rotate token encryption keys.",
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
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("socialflow-token-encryption-salt-v1"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a token using AES-GCM.
 * 
 * @param plaintext - The token to encrypt (e.g., access_token or id_token)
 * @returns Encrypted string in format: encrypted:v1:aes-gcm:<iv>:<ciphertext>
 * @throws TokenEncryptionError if encryption secret is missing or encryption fails
 */
export async function encryptToken(plaintext: string | null | undefined): Promise<string | null> {
  if (!plaintext) return null;
  
  try {
    const secret = getPrimaryEncryptionSecret();
    const key = await deriveKey(secret);
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      data
    );
    
    const ivBase64 = base64Encode(iv.buffer);
    const ciphertextBase64 = base64Encode(ciphertext);
    
    return `${ENCRYPTION_PREFIX}:${ENCRYPTION_VERSION}:${ENCRYPTION_ALGORITHM}:${ivBase64}:${ciphertextBase64}`;
  } catch (error) {
    if (error instanceof TokenEncryptionError) {
      throw error;
    }
    throw new TokenEncryptionError(
      `Token encryption failed: ${error instanceof Error ? error.message : String(error)}`,
      "ENCRYPTION_FAILED"
    );
  }
}

/**
 * Encrypts a token using NEXT key material for controlled key-rotation flows.
 */
export async function encryptTokenWithNext(plaintext: string | null | undefined): Promise<string | null> {
  if (!plaintext) return null;

  try {
    const secret = getNextEncryptionSecret();
    const key = await deriveKey(secret);
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      data,
    );

    const ivBase64 = base64Encode(iv.buffer);
    const ciphertextBase64 = base64Encode(ciphertext);
    return `${ENCRYPTION_PREFIX}:${ENCRYPTION_VERSION}:${ENCRYPTION_ALGORITHM}:${ivBase64}:${ciphertextBase64}`;
  } catch (error) {
    if (error instanceof TokenEncryptionError) {
      throw error;
    }
    throw new TokenEncryptionError(
      `Token encryption failed: ${error instanceof Error ? error.message : String(error)}`,
      "ENCRYPTION_FAILED",
    );
  }
}

type DecryptTokenOptions = {
  allowNextFallback?: boolean;
};

/**
 * Decrypts a token that was encrypted with encryptToken.
 * 
 * @param encrypted - Encrypted token string or plaintext (for backward compatibility)
 * @returns Decrypted token string
 * @throws TokenEncryptionError if decryption fails
 */
export async function decryptToken(
  encrypted: string | null | undefined,
  options?: DecryptTokenOptions,
): Promise<string | null> {
  if (!encrypted) return null;
  
  // Check if token looks like it's encrypted (starts with "encrypted:")
  // If so, try to decrypt it even if format is wrong (will throw proper error)
  const looksEncrypted = encrypted.startsWith(`${ENCRYPTION_PREFIX}:`);
  
  if (!looksEncrypted) {
    // Backward compatibility: return plaintext token as-is
    return encrypted;
  }
  
  try {
    const parts = encrypted.split(":");
    
    if (parts.length !== 5) {
      throw new TokenEncryptionError(
        "Invalid encrypted token format. Expected 5 parts separated by colon.",
        "INVALID_FORMAT"
      );
    }
    
    const [prefix, version, algorithm, ivBase64, ciphertextBase64] = parts;
    
    if (prefix !== ENCRYPTION_PREFIX) {
      throw new TokenEncryptionError(
        `Invalid encryption prefix. Expected '${ENCRYPTION_PREFIX}', got '${prefix}'.`,
        "INVALID_PREFIX"
      );
    }
    
    if (version !== ENCRYPTION_VERSION) {
      throw new TokenEncryptionError(
        `Unsupported encryption version. Expected '${ENCRYPTION_VERSION}', got '${version}'.`,
        "UNSUPPORTED_VERSION"
      );
    }
    
    if (algorithm !== ENCRYPTION_ALGORITHM) {
      throw new TokenEncryptionError(
        `Unsupported encryption algorithm. Expected '${ENCRYPTION_ALGORITHM}', got '${algorithm}'.`,
        "UNSUPPORTED_ALGORITHM"
      );
    }
    
    const secret = getPrimaryEncryptionSecret();
    const key = await deriveKey(secret);
    const iv = base64Decode(ivBase64);
    const ciphertext = base64Decode(ciphertextBase64);
    
    let plaintext: ArrayBuffer;
    try {
      plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
        key,
        ciphertext.buffer as ArrayBuffer,
      );
    } catch (error) {
      const allowNextFallback = options?.allowNextFallback ?? true;
      if (!allowNextFallback || !isNextEncryptionAvailable()) {
        throw error;
      }

      const nextSecret = getNextEncryptionSecret();
      const nextKey = await deriveKey(nextSecret);
      plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
        nextKey,
        ciphertext.buffer as ArrayBuffer,
      );
    }
    
    return new TextDecoder().decode(plaintext);
  } catch (error) {
    if (error instanceof TokenEncryptionError) {
      throw error;
    }
    throw new TokenEncryptionError(
      `Token decryption failed: ${error instanceof Error ? error.message : String(error)}`,
      "DECRYPTION_FAILED"
    );
  }
}

/**
 * Re-encrypts a token with NEXT key material.
 * - Encrypted input: decrypted with current key only, then encrypted with NEXT.
 * - Plaintext input: encrypted directly with NEXT.
 */
export async function reencryptTokenWithNext(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (!value.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return encryptTokenWithNext(value);
  }

  const plaintext = await decryptToken(value, { allowNextFallback: false });
  if (!plaintext) return null;
  return encryptTokenWithNext(plaintext);
}

/**
 * Checks if a token string is encrypted.
 * 
 * @param value - Token string to check
 * @returns true if encrypted, false if plaintext
 */
export function isEncryptedToken(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith(`${ENCRYPTION_PREFIX}:${ENCRYPTION_VERSION}:${ENCRYPTION_ALGORITHM}:`);
}

/**
 * Masks a token for safe display in logs/debug output.
 * Shows only first 4 and last 4 characters.
 * 
 * @param token - Token to mask
 * @returns Masked token (e.g., "AQV8...2345") or "<none>" if empty
 */
export function maskToken(token: string | null | undefined): string {
  if (!token) return "<none>";
  if (token.length <= 8) return "***";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

/**
 * Redacts sensitive fields from auth_meta for safe debug output.
 * Removes accessToken and idToken, replaces with presence indicators.
 * 
 * @param authMeta - Auth metadata object
 * @returns Redacted auth metadata safe for logging
 */
export function redactAuthMeta(authMeta: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!authMeta) return null;
  
  const redacted: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(authMeta)) {
    if (key === "accessToken") {
      redacted.accessTokenPresent = !!value;
      redacted.accessTokenEncrypted = typeof value === "string" ? isEncryptedToken(value) : false;
    } else if (key === "idToken") {
      redacted.idTokenPresent = !!value;
      redacted.idTokenEncrypted = typeof value === "string" ? isEncryptedToken(value) : false;
    } else {
      // Keep non-sensitive fields as-is
      redacted[key] = value;
    }
  }
  
  return redacted;
}

/**
 * Checks if encryption is available (secret is configured).
 * 
 * @returns true if encryption secret is available, false otherwise
 */
export function isEncryptionAvailable(): boolean {
  try {
    const env = getSocialFlowRuntimeEnv();
    const secret = env?.SOCIALFLOW_TOKEN_ENCRYPTION_SECRET?.trim();
    return !!(secret && secret.length >= 32);
  } catch {
    return false;
  }
}

export function isNextEncryptionAvailable(): boolean {
  try {
    const env = getSocialFlowRuntimeEnv();
    const secret = env?.SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT?.trim();
    return !!(secret && secret.length >= 32);
  } catch {
    return false;
  }
}
