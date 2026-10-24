import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { shouldBypassLocalLinkedInOAuthRateLimit } from "@/middleware";

describe("shouldBypassLocalLinkedInOAuthRateLimit", () => {
  it("bypasses GET linkedin connect on local wrangler host", () => {
    const request = new NextRequest("http://localhost:8787/api/social/linkedin/connect?saasId=socialflow", {
      method: "GET",
      headers: {
        host: "localhost:8787",
      },
    });

    expect(shouldBypassLocalLinkedInOAuthRateLimit(request)).toBe(true);
  });

  it("does not bypass the same route on non-local hosts", () => {
    const request = new NextRequest("https://drako.systems/api/social/linkedin/connect?saasId=socialflow", {
      method: "GET",
      headers: {
        host: "drako.systems",
      },
    });

    expect(shouldBypassLocalLinkedInOAuthRateLimit(request)).toBe(false);
  });

  it("does not bypass other linkedin routes on local worker host", () => {
    const request = new NextRequest("http://localhost:8787/api/social/linkedin/publish", {
      method: "GET",
      headers: {
        host: "localhost:8787",
      },
    });

    expect(shouldBypassLocalLinkedInOAuthRateLimit(request)).toBe(false);
  });
});
