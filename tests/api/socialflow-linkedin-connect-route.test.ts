import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/socialflow/linkedin/connect/route";

describe("/api/socialflow/linkedin/connect", () => {
  it("returns 401 instead of 500 when the caller has no session", async () => {
    const response = await GET(
      new Request("https://socialflow.drako.systems/api/socialflow/linkedin/connect?saasId=socialflow", {
        headers: {
          host: "socialflow.drako.systems",
          origin: "https://socialflow.drako.systems",
        },
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "SESSION_REQUIRED" });
  });
});
