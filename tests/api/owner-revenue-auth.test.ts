import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOwnerAccess: vi.fn(),
  queryAll: vi.fn(),
}));

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>("@/lib/auth/session");
  return {
    ...actual,
    requireOwnerAccess: mocks.requireOwnerAccess,
  };
});

vi.mock("@/lib/db", () => ({
  queryAll: mocks.queryAll,
}));

import { GET } from "@/app/api/owner/revenue/route";
import { UnauthorizedError } from "@/lib/auth/session";

describe("/api/owner/revenue owner guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no owner session", async () => {
    mocks.requireOwnerAccess.mockRejectedValue(new UnauthorizedError("SESSION_REQUIRED", 401));

    const response = await GET(new Request("https://drako.systems/api/owner/revenue"));
    expect(response.status).toBe(401);
    expect(mocks.queryAll).not.toHaveBeenCalled();
  });

  it("returns 403 when role is not owner-level", async () => {
    mocks.requireOwnerAccess.mockRejectedValue(new UnauthorizedError("OWNER_ROLE_REQUIRED", 403));

    const response = await GET(new Request("https://drako.systems/api/owner/revenue"));
    expect(response.status).toBe(403);
    expect(mocks.queryAll).not.toHaveBeenCalled();
  });
});
