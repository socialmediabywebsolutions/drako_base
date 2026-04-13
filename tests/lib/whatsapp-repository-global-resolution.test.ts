import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryAll: vi.fn(),
  run: vi.fn(),
  env: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  queryAll: mocks.queryAll,
  run: mocks.run,
}));

vi.mock("@/lib/cf", () => ({
  env: mocks.env,
}));

import { findWhatsappIdentityByPhoneAndLineGlobal } from "@/lib/whatsapp/repository";

function makeIdentityRow(input: {
  id: string;
  tenantId: string;
  saasId: string;
  phoneNumber: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
}) {
  return {
    id: input.id,
    tenant_id: input.tenantId,
    saas_id: input.saasId,
    actor_type: "CUSTOMER",
    actor_id: `${input.id}-actor`,
    phone_number: input.phoneNumber,
    preferred_language: null,
    allowed_channels: null,
    consent_flags: null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    created_at: input.createdAt ?? "2026-04-13T12:00:00.000Z",
    updated_at: input.createdAt ?? "2026-04-13T12:00:00.000Z",
  };
}

describe("findWhatsappIdentityByPhoneAndLineGlobal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.mockReturnValue({ DRACO_DB: {} });
  });

  it("resolves correct identity by phone + phoneNumberId across cross-tenant collisions", async () => {
    mocks.queryAll.mockResolvedValue([
      makeIdentityRow({
        id: "id-tenant-b",
        tenantId: "tenant-b",
        saasId: "saas-b",
        phoneNumber: "+573001112233",
        metadata: { phoneNumberId: "line-b" },
        createdAt: "2026-04-13T12:05:00.000Z",
      }),
      makeIdentityRow({
        id: "id-tenant-a",
        tenantId: "tenant-a",
        saasId: "saas-a",
        phoneNumber: "+573001112233",
        metadata: { phoneNumberId: "line-a" },
        createdAt: "2026-04-13T12:00:00.000Z",
      }),
    ]);

    const resolved = await findWhatsappIdentityByPhoneAndLineGlobal({
      phoneNumber: "+573001112233",
      phoneNumberId: "line-a",
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.tenantId).toBe("tenant-a");
    expect(resolved?.saasId).toBe("saas-a");
  });

  it("fails closed when phone is ambiguous and no line hints are provided", async () => {
    mocks.queryAll.mockResolvedValue([
      makeIdentityRow({
        id: "id-1",
        tenantId: "tenant-a",
        saasId: "saas-a",
        phoneNumber: "+573001112233",
      }),
      makeIdentityRow({
        id: "id-2",
        tenantId: "tenant-b",
        saasId: "saas-b",
        phoneNumber: "+573001112233",
      }),
    ]);

    const resolved = await findWhatsappIdentityByPhoneAndLineGlobal({
      phoneNumber: "+573001112233",
    });

    expect(resolved).toBeNull();
  });

  it("keeps compatibility when phone is globally unique", async () => {
    mocks.queryAll.mockResolvedValue([
      makeIdentityRow({
        id: "id-unique",
        tenantId: "tenant-a",
        saasId: "saas-a",
        phoneNumber: "+573001112233",
      }),
    ]);

    const resolved = await findWhatsappIdentityByPhoneAndLineGlobal({
      phoneNumber: "+573001112233",
    });

    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe("id-unique");
  });

  it("fails closed when line hint does not match any candidate and phone is ambiguous", async () => {
    mocks.queryAll.mockResolvedValue([
      makeIdentityRow({
        id: "id-1",
        tenantId: "tenant-a",
        saasId: "saas-a",
        phoneNumber: "+573001112233",
        metadata: { phoneNumberId: "line-a" },
      }),
      makeIdentityRow({
        id: "id-2",
        tenantId: "tenant-b",
        saasId: "saas-b",
        phoneNumber: "+573001112233",
        metadata: { phoneNumberId: "line-b" },
      }),
    ]);

    const resolved = await findWhatsappIdentityByPhoneAndLineGlobal({
      phoneNumber: "+573001112233",
      phoneNumberId: "line-x",
    });

    expect(resolved).toBeNull();
  });
});
