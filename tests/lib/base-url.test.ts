import { describe, expect, it, vi } from "vitest";
import { getRequestBaseUrl } from "@/lib/http/base-url";

vi.mock("@/lib/cf", () => ({
  env: vi.fn(() => null),
}));

describe("getRequestBaseUrl", () => {
  it("prefers the effective request host for production tenant surfaces", () => {
    const request = new Request("https://mentoria.drako.systems/api/mentoria/billing/checkout", {
      headers: {
        host: "mentoria.drako.systems",
        "x-forwarded-proto": "https",
      },
    });

    expect(getRequestBaseUrl(request)).toBe("https://mentoria.drako.systems");
  });

  it("falls back to configured app url for localhost requests", () => {
    process.env.APP_URL = "https://drako.systems";
    const request = new Request("http://localhost:3000/api/test", {
      headers: {
        host: "localhost:3000",
      },
    });

    expect(getRequestBaseUrl(request)).toBe("https://drako.systems");
    delete process.env.APP_URL;
  });
});
