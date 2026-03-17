import { describe, it, expect } from "vitest";
import { getAuthsCookieConfig, getAuthsCookieName } from "@/lib/auths/cookies";
import { createAuthsSessionToken, verifyAuthsSessionToken } from "@/lib/auths/tokens";
import { resolveAuthsContextFromHost, resolveAuthsContextFromRequest } from "@/lib/auths/contexts";

describe("Auths Isolation", () => {
  it("uses different cookie names per saas", () => {
    const drakosCookie = getAuthsCookieName("drakos");
    const mentoriasCookie = getAuthsCookieName("mentorias");

    expect(drakosCookie).toBe(getAuthsCookieConfig("drakos").cookieName);
    expect(mentoriasCookie).toBe(getAuthsCookieConfig("mentorias").cookieName);
    expect(drakosCookie).toMatch(/^__Host-.*_session$/);
    expect(mentoriasCookie).toMatch(/^__Host-.*_session$/);
    expect(drakosCookie).not.toBe(mentoriasCookie);
  });

  it("resolves host context using subdomains", () => {
    expect(resolveAuthsContextFromHost("drako.systems")).toBe("drakos");
    expect(resolveAuthsContextFromHost("mentoria.drako.systems")).toBe("mentorias");
    expect(resolveAuthsContextFromHost("base.drako.systems")).toBe("bases");
  });

  it("resolves tenant workspace auth by path and host surface", () => {
    expect(resolveAuthsContextFromRequest(new Request("https://bases.drako.systems/client", {
      headers: { host: "bases.drako.systems" },
    }))).toBe("bases");

    expect(resolveAuthsContextFromRequest(new Request("https://app.socialflow.example.com/client", {
      headers: { host: "app.socialflow.example.com" },
    }))).toBe("drakos");

    expect(resolveAuthsContextFromRequest(new Request("https://mentorias.drako.systems/client", {
      headers: { host: "mentorias.drako.systems" },
    }))).toBe("mentorias");
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
