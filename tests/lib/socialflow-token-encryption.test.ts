import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeSecret = vi.hoisted(() => ({
  value: "test-socialflow-token-encryption-secret-min-32",
  next: "",
}));

vi.mock("@/lib/cf", () => ({
  env: () => ({
    SOCIALFLOW_TOKEN_ENCRYPTION_SECRET: runtimeSecret.value,
    SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT: runtimeSecret.next,
  }),
}));

import {
  decryptToken,
  encryptToken,
  encryptTokenWithNext,
  isEncryptedToken,
  isNextEncryptionAvailable,
  reencryptTokenWithNext,
  TokenEncryptionError,
} from "@/lib/socialflow/token-encryption";

describe("socialflow token encryption", () => {
  beforeEach(() => {
    runtimeSecret.value = "test-socialflow-token-encryption-secret-min-32";
    runtimeSecret.next = "";
  });

  it("encrypts and decrypts tokens", async () => {
    const encrypted = await encryptToken("token-123");
    expect(encrypted).toBeTruthy();
    expect(isEncryptedToken(encrypted)).toBe(true);
    expect(await decryptToken(encrypted)).toBe("token-123");
  });

  it("keeps legacy plaintext compatibility", async () => {
    expect(await decryptToken("legacy-plain-token")).toBe("legacy-plain-token");
  });

  it("fails closed when encrypted token needs missing secret", async () => {
    const encrypted = await encryptToken("token-xyz");
    runtimeSecret.value = "";
    await expect(decryptToken(encrypted)).rejects.toMatchObject<TokenEncryptionError>({
      name: "TokenEncryptionError",
      code: "ENCRYPTION_SECRET_MISSING",
    });
  });

  it("supports controlled NEXT-key fallback during rotation", async () => {
    runtimeSecret.next = "test-socialflow-token-encryption-next-secret-min-32";
    const encryptedWithNext = await encryptTokenWithNext("token-next");
    await expect(decryptToken(encryptedWithNext)).resolves.toBe("token-next");
  });

  it("fails closed when NEXT fallback is disabled", async () => {
    runtimeSecret.next = "test-socialflow-token-encryption-next-secret-min-32";
    const encryptedWithNext = await encryptTokenWithNext("token-next");
    await expect(decryptToken(encryptedWithNext, { allowNextFallback: false })).rejects.toMatchObject<TokenEncryptionError>({
      name: "TokenEncryptionError",
      code: "DECRYPTION_FAILED",
    });
  });

  it("re-encrypts current ciphertext to NEXT key", async () => {
    runtimeSecret.next = "test-socialflow-token-encryption-next-secret-min-32";
    const encryptedCurrent = await encryptToken("token-rotate");
    const rotated = await reencryptTokenWithNext(encryptedCurrent);
    expect(rotated).toMatch(/^encrypted:v1:aes-gcm:/);
    expect(rotated).not.toBe(encryptedCurrent);
    await expect(decryptToken(rotated)).resolves.toBe("token-rotate");
  });

  it("reports NEXT-key availability", () => {
    expect(isNextEncryptionAvailable()).toBe(false);
    runtimeSecret.next = "test-socialflow-token-encryption-next-secret-min-32";
    expect(isNextEncryptionAvailable()).toBe(true);
  });
});
