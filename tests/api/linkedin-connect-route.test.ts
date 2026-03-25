import { beforeEach, describe, expect, it, vi } from "vitest";

const requireTenantAccess = vi.hoisted(() => vi.fn());
const UnauthorizedError = vi.hoisted(() => class UnauthorizedError extends Error {
  status: number;

  constructor(message = "Unauthorized", status = 401) {
    super(message);
    this.status = status;
  }
});

vi.mock("@/lib/auth/session", () => ({
  requireTenantAccess,
  UnauthorizedError,
}));

import { GET } from "@/app/api/social/linkedin/connect/route";

describe("/api/social/linkedin/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireTenantAccess.mockResolvedValue({ tenantId: "tenant_socialflow" });
    process.env.LINKEDIN_CLIENT_ID = "linkedin-client-id";
  });

  it("redirects to linkedin authorization with tenant and saas state", async () => {
    const response = await GET(new Request("https://drako.local/api/social/linkedin/connect?saasId=socialflow") as any);

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("https://www.linkedin.com/oauth/v2/authorization");
    expect(location).toContain("client_id=linkedin-client-id");
    expect(location).toContain("state=tenant_socialflow__socialflow");
  });

  it("uses localhost:8787 callback for wrangler dev even when NEXTAUTH_URL points elsewhere", async () => {
    process.env.NEXTAUTH_URL = "https://drako.systems";

    const response = await GET(new Request("http://localhost:8787/api/social/linkedin/connect?saasId=socialflow") as any);

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(decodeURIComponent(location)).toContain("redirect_uri=http://localhost:8787/auth/linkedin/callback");
  });

  it("keeps localhost:3000 callback for next dev when request originates there", async () => {
    process.env.NEXTAUTH_URL = "https://drako.systems";

    const response = await GET(new Request("http://localhost:3000/api/social/linkedin/connect?saasId=socialflow") as any);

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(decodeURIComponent(location)).toContain("redirect_uri=http://localhost:3000/auth/linkedin/callback");
  });
});
