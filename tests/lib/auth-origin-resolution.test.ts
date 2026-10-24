import { describe, expect, it } from "vitest";
import { resolveAuthOriginFromRequest } from "@/lib/auths/origin";

describe("resolveAuthOriginFromRequest", () => {
  it("resolves drakos origin from host header", () => {
    const req = new Request("https://internal/api/billing/portal", {
      headers: {
        host: "drako.systems",
      },
    });
    expect(resolveAuthOriginFromRequest(req)).toBe("https://drako.systems");
  });

  it("resolves mentorias origin from forwarded host header", () => {
    const req = new Request("https://internal/api/billing/portal", {
      headers: {
        "x-forwarded-host": "mentorias.drako.systems",
      },
    });
    expect(resolveAuthOriginFromRequest(req)).toBe("https://mentorias.drako.systems");
  });

  it("resolves bases origin from effective host and forwarded proto", () => {
    const req = new Request("https://internal/api/billing/portal", {
      headers: {
        "x-drako-effective-host": "bases.drako.systems",
        "x-forwarded-proto": "https",
      },
    });
    expect(resolveAuthOriginFromRequest(req)).toBe("https://bases.drako.systems");
  });

  it("ignores spoofed host/header values outside allowlist and falls back to canonical context origin", () => {
    const req = new Request("https://internal/api/billing/portal", {
      headers: {
        host: "evil.example.com",
        "x-forwarded-host": "attacker.example.com",
        "x-drako-effective-host": "attacker.example.com",
        "x-forwarded-proto": "http",
      },
    });
    expect(resolveAuthOriginFromRequest(req)).toBe("https://drako.systems");
  });
});
