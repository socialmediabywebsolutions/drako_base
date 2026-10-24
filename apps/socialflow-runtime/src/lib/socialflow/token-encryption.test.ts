import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  encryptToken,
  encryptTokenWithNext,
  decryptToken,
  reencryptTokenWithNext,
  isEncryptedToken,
  maskToken,
  redactAuthMeta,
  isEncryptionAvailable,
  isNextEncryptionAvailable,
  TokenEncryptionError,
} from "./token-encryption";
import { setSocialFlowRuntimeEnv } from "../runtime-env";

describe("Token Encryption", () => {
  const testSecret = "test-encryption-secret-minimum-32-chars-long-value";

  beforeEach(() => {
    // Set up runtime environment with encryption secret before each test
    setSocialFlowRuntimeEnv({
      SOCIALFLOW_TOKEN_ENCRYPTION_SECRET: testSecret,
    });
  });

  afterEach(() => {
    // Clean up after each test
    setSocialFlowRuntimeEnv(null);
  });

  describe("encryptToken", () => {
    it("should encrypt a token", async () => {
      const plaintext = "AQV8n4YsOr_fake_linkedin_access_token_12345";
      const encrypted = await encryptToken(plaintext);

      expect(encrypted).not.toBeNull();
      expect(encrypted).not.toContain(plaintext);
      expect(encrypted).toMatch(/^encrypted:v1:aes-gcm:/);
    });

    it("should return null for null input", async () => {
      const result = await encryptToken(null);
      expect(result).toBeNull();
    });

    it("should return null for undefined input", async () => {
      const result = await encryptToken(undefined);
      expect(result).toBeNull();
    });

    it("should throw error if encryption secret is missing", async () => {
      setSocialFlowRuntimeEnv({});

      await expect(encryptToken("test-token")).rejects.toThrow(
        TokenEncryptionError
      );
      await expect(encryptToken("test-token")).rejects.toThrow(
        "SOCIALFLOW_TOKEN_ENCRYPTION_SECRET is not configured"
      );
    });

    it("should throw error if encryption secret is too short", async () => {
      setSocialFlowRuntimeEnv({
        SOCIALFLOW_TOKEN_ENCRYPTION_SECRET: "short",
      });

      await expect(encryptToken("test-token")).rejects.toThrow(
        TokenEncryptionError
      );
    });
  });

  describe("decryptToken", () => {
    it("should decrypt an encrypted token", async () => {
      const plaintext = "AQV8n4YsOr_fake_linkedin_access_token_12345";
      const encrypted = await encryptToken(plaintext);
      const decrypted = await decryptToken(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle plaintext tokens (backward compatibility)", async () => {
      const plaintext = "AQV8n4YsOr_plaintext_token";
      const decrypted = await decryptToken(plaintext);

      expect(decrypted).toBe(plaintext);
    });

    it("should return null for null input", async () => {
      const result = await decryptToken(null);
      expect(result).toBeNull();
    });

    it("should return null for undefined input", async () => {
      const result = await decryptToken(undefined);
      expect(result).toBeNull();
    });

    it("should throw error for invalid encrypted format", async () => {
      await expect(decryptToken("encrypted:invalid:format")).rejects.toThrow(
        TokenEncryptionError
      );
    });

    it("should throw error for unsupported version", async () => {
      await expect(
        decryptToken("encrypted:v2:aes-gcm:iv:ciphertext")
      ).rejects.toThrow(TokenEncryptionError);
    });

    it("should throw error for unsupported algorithm", async () => {
      await expect(
        decryptToken("encrypted:v1:aes-cbc:iv:ciphertext")
      ).rejects.toThrow(TokenEncryptionError);
    });

    it("supports NEXT-key fallback during controlled rotation", async () => {
      const nextSecret = "next-encryption-secret-minimum-32-chars-long-value";
      setSocialFlowRuntimeEnv({
        SOCIALFLOW_TOKEN_ENCRYPTION_SECRET: testSecret,
        SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT: nextSecret,
      });

      const encryptedWithNext = await encryptTokenWithNext("rotation-token");
      const decrypted = await decryptToken(encryptedWithNext);
      expect(decrypted).toBe("rotation-token");
    });

    it("fails closed when NEXT fallback is disabled", async () => {
      const nextSecret = "next-encryption-secret-minimum-32-chars-long-value";
      setSocialFlowRuntimeEnv({
        SOCIALFLOW_TOKEN_ENCRYPTION_SECRET: testSecret,
        SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT: nextSecret,
      });

      const encryptedWithNext = await encryptTokenWithNext("rotation-token");
      await expect(decryptToken(encryptedWithNext, { allowNextFallback: false })).rejects.toThrow(
        TokenEncryptionError,
      );
    });
  });

  describe("isEncryptedToken", () => {
    it("should return true for encrypted tokens", async () => {
      const encrypted = await encryptToken("test-token");
      expect(isEncryptedToken(encrypted)).toBe(true);
    });

    it("should return false for plaintext tokens", () => {
      expect(isEncryptedToken("AQV8n4YsOr_plaintext_token")).toBe(false);
    });

    it("should return false for null", () => {
      expect(isEncryptedToken(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isEncryptedToken(undefined)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(isEncryptedToken("")).toBe(false);
    });
  });

  describe("maskToken", () => {
    it("should mask a long token", () => {
      const token = "AQV8n4YsOr_fake_linkedin_access_token_12345";
      const masked = maskToken(token);

      expect(masked).toBe("AQV8...2345");
      expect(masked).not.toContain("fake_linkedin_access_token");
    });

    it("should return *** for short tokens", () => {
      expect(maskToken("short")).toBe("***");
    });

    it("should return <none> for null", () => {
      expect(maskToken(null)).toBe("<none>");
    });

    it("should return <none> for undefined", () => {
      expect(maskToken(undefined)).toBe("<none>");
    });

    it("should return <none> for empty string", () => {
      expect(maskToken("")).toBe("<none>");
    });
  });

  describe("redactAuthMeta", () => {
    it("should redact accessToken and idToken", async () => {
      const authMeta = {
        accessToken: "AQV8n4YsOr_access_token",
        idToken: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
        mode: "live",
        scope: "openid profile email",
        profileId: "abc123",
        email: "user@example.com",
      };

      const redacted = redactAuthMeta(authMeta);

      expect(redacted).not.toHaveProperty("accessToken");
      expect(redacted).not.toHaveProperty("idToken");
      expect(redacted).toHaveProperty("accessTokenPresent", true);
      expect(redacted).toHaveProperty("idTokenPresent", true);
      expect(redacted).toHaveProperty("accessTokenEncrypted", false);
      expect(redacted).toHaveProperty("idTokenEncrypted", false);
      expect(redacted).toHaveProperty("mode", "live");
      expect(redacted).toHaveProperty("scope", "openid profile email");
      expect(redacted).toHaveProperty("profileId", "abc123");
      expect(redacted).toHaveProperty("email", "user@example.com");
    });

    it("should detect encrypted tokens", async () => {
      const encryptedToken = await encryptToken("test-token");
      const authMeta = {
        accessToken: encryptedToken,
        idToken: null,
      };

      const redacted = redactAuthMeta(authMeta);

      expect(redacted).toHaveProperty("accessTokenPresent", true);
      expect(redacted).toHaveProperty("accessTokenEncrypted", true);
      expect(redacted).toHaveProperty("idTokenPresent", false);
      expect(redacted).toHaveProperty("idTokenEncrypted", false);
    });

    it("should return null for null input", () => {
      expect(redactAuthMeta(null)).toBeNull();
    });

    it("should handle empty auth meta", () => {
      const redacted = redactAuthMeta({});
      expect(redacted).toEqual({});
    });
  });

  describe("isEncryptionAvailable", () => {
    it("should return true when encryption secret is available", () => {
      setSocialFlowRuntimeEnv({
        SOCIALFLOW_TOKEN_ENCRYPTION_SECRET: testSecret,
      });

      expect(isEncryptionAvailable()).toBe(true);
    });

    it("should return false when encryption secret is missing", () => {
      setSocialFlowRuntimeEnv({});
      expect(isEncryptionAvailable()).toBe(false);
    });

    it("should return false when encryption secret is too short", () => {
      setSocialFlowRuntimeEnv({
        SOCIALFLOW_TOKEN_ENCRYPTION_SECRET: "short",
      });

      expect(isEncryptionAvailable()).toBe(false);
    });

    it("should return false when runtime env is null", () => {
      setSocialFlowRuntimeEnv(null);
      expect(isEncryptionAvailable()).toBe(false);
    });
  });

  describe("NEXT key availability", () => {
    it("returns true when next key exists", () => {
      setSocialFlowRuntimeEnv({
        SOCIALFLOW_TOKEN_ENCRYPTION_SECRET: testSecret,
        SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT: "next-encryption-secret-minimum-32-chars-long-value",
      });
      expect(isNextEncryptionAvailable()).toBe(true);
    });

    it("returns false when next key is missing", () => {
      setSocialFlowRuntimeEnv({
        SOCIALFLOW_TOKEN_ENCRYPTION_SECRET: testSecret,
      });
      expect(isNextEncryptionAvailable()).toBe(false);
    });
  });

  describe("reencryptTokenWithNext", () => {
    it("re-encrypts encrypted token from current to next", async () => {
      const nextSecret = "next-encryption-secret-minimum-32-chars-long-value";
      setSocialFlowRuntimeEnv({
        SOCIALFLOW_TOKEN_ENCRYPTION_SECRET: testSecret,
        SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT: nextSecret,
      });

      const encryptedCurrent = await encryptToken("token-for-rotation");
      const encryptedNext = await reencryptTokenWithNext(encryptedCurrent);

      expect(encryptedNext).toMatch(/^encrypted:v1:aes-gcm:/);
      expect(encryptedNext).not.toBe(encryptedCurrent);
      expect(await decryptToken(encryptedNext)).toBe("token-for-rotation");
    });
  });

  describe("End-to-end encryption flow", () => {
    it("should encrypt and decrypt correctly", async () => {
      const originalToken = "AQV8n4YsOr_real_linkedin_token_with_special_chars_!@#$%";
      
      // Encrypt
      const encrypted = await encryptToken(originalToken);
      expect(encrypted).not.toBeNull();
      expect(encrypted).not.toContain(originalToken);
      expect(isEncryptedToken(encrypted)).toBe(true);

      // Decrypt
      const decrypted = await decryptToken(encrypted);
      expect(decrypted).toBe(originalToken);
    });

    it("should handle multiple encrypt/decrypt cycles", async () => {
      const token = "test-token-cycle";

      for (let i = 0; i < 5; i++) {
        const encrypted = await encryptToken(token);
        const decrypted = await decryptToken(encrypted);
        expect(decrypted).toBe(token);
      }
    });
  });
});
