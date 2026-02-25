import { describe, it, expect } from "vitest";
import { getAuthsCookieName } from "@/lib/auths/cookies";
import { createAuthsSessionToken, verifyAuthsSessionToken } from "@/lib/auths/tokens";
import { resolveAuthsContextFromHost } from "@/lib/auths/contexts";

describe("Auths Isolation", () => {
  it("uses different cookie names per saas", () => {
    expect(getAuthsCookieName("drakos")).toBe("drakos_session");
    expect(getAuthsCookieName("mentorias")).toBe("mentorias_session");
    expect(getAuthsCookieName("drakos")).not.toBe(getAuthsCookieName("mentorias"));
  });

  it("resolves host context using subdomains", () => {
    expect(resolveAuthsContextFromHost("drako.systems")).toBe("drakos");
    expect(resolveAuthsContextFromHost("mentoria.drako.systems")).toBe("mentorias");
    expect(resolveAuthsContextFromHost("base.drako.systems")).toBe("bases");
  });

  it("rejects drakos tokens in mentorias context", async () => {
    process.env.DRAKOS_AUTHS_SECRET = "drakos_test_secret_1234567890";
    process.env.MENTORIAS_AUTHS_SECRET = "mentorias_test_secret_0987654321";

    const token = await createAuthsSessionToken({
      context: "drakos",
      sub: "u-1",
      email: "user@example.com",
      tenantId: "tenant-1",
      role: "user",
    });

    const accepted = await verifyAuthsSessionToken(token, "drakos");
    const rejected = await verifyAuthsSessionToken(token, "mentorias");

    expect(accepted).not.toBeNull();
    expect(rejected).toBeNull();
  });
});
