import { describe, expect, it } from "vitest";

import { DELETE, GET, PATCH, POST, PUT } from "@/app/api/social/linkedin/publish/route";

describe("/api/social/linkedin/publish legacy boundary", () => {
  it.each([
    ["GET", GET],
    ["POST", POST],
    ["PATCH", PATCH],
    ["PUT", PUT],
    ["DELETE", DELETE],
  ])("blocks %s with the canonical SocialFlow endpoint", async (_method, handler) => {
    const response = await handler();
    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload).toEqual({
      ok: false,
      error: "LEGACY_SOCIAL_ROUTE_DISABLED",
      canonical: "/api/socialflow/posts",
    });
  });
});
