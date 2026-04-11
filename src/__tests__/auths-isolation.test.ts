import { describe, it, expect } from "vitest";
import { getAuthsCookieConfig, getAuthsCookieName } from "@/lib/auths/cookies";
import { createAuthsSessionToken, verifyAuthsSessionToken } from "@/lib/auths/tokens";
import { resolveAuthsContextFromHost, resolveAuthsContextFromRequest } from "@/lib/auths/contexts";

describe("Auths Isolation", () => {
  it("uses different cookie names per saas", () => {
    const drakosCookie = getAuthsCookieName("drakos");
    const mentoriasCookie = getAuthsCookieName("mentorias");
    const socialflowCookie = getAuthsCookieName("socialflow");

    expect(drakosCookie).toBe(getAuthsCookieConfig("drakos").cookieName);
    expect(mentoriasCookie).toBe(getAuthsCookieConfig("mentorias").cookieName);
    expect(socialflowCookie).toBe(getAuthsCookieConfig("socialflow").cookieName);
    expect(drakosCookie).toMatch(/^__Host-.*_session$/);
    expect(mentoriasCookie).toMatch(/^__Host-.*_session$/);
    expect(socialflowCookie).toMatch(/^__Host-.*_session$/);
    expect(drakosCookie).not.toBe(mentoriasCookie);
    expect(drakosCookie).not.toBe(socialflowCookie);
  });

  it("drops __Host- and Secure only for real localhost requests", () => {
    const localRequest = new Request("http://127.0.0.1:8787/api/mentorias/auths/logins", {
      headers: { host: "127.0.0.1:8787" },
    });

    const localConfig = getAuthsCookieConfig("mentorias", localRequest);

    expect(localConfig.cookieName).toBe("mentorias_session");
    expect(localConfig.secure).toBe(false);
    expect(getAuthsCookieName("mentorias", localRequest)).toBe("mentorias_session");
  });

  it("fails closed for production or unknown cookie runtime", () => {
    const productionRequest = new Request("https://mentoria.drako.systems/api/mentorias/auths/logins", {
      headers: { host: "mentoria.drako.systems" },
    });

    expect(getAuthsCookieConfig("mentorias").cookieName).toBe("__Host-mentorias_session");
    expect(getAuthsCookieConfig("mentorias").secure).toBe(true);
    expect(getAuthsCookieConfig("mentorias", productionRequest).cookieName).toBe("__Host-mentorias_session");
    expect(getAuthsCookieConfig("mentorias", productionRequest).secure).toBe(true);
  });

  it("resolves host context using subdomains", () => {
    expect(resolveAuthsContextFromHost("drako.systems")).toBe("drakos");
    expect(resolveAuthsContextFromHost("mentoria.drako.systems")).toBe("mentorias");
    expect(resolveAuthsContextFromHost("app.socialflow.example.com")).toBe("socialflow");
    expect(resolveAuthsContextFromHost("base.drako.systems")).toBe("bases");
  });

  it("resolves tenant workspace auth by path and host surface", () => {
    expect(resolveAuthsContextFromRequest(new Request("https://bases.drako.systems/socialflow", {
      headers: { host: "bases.drako.systems" },
    }))).toBe("bases");

    expect(resolveAuthsContextFromRequest(new Request("https://app.socialflow.example.com/socialflow", {
      headers: { host: "app.socialflow.example.com" },
    }))).toBe("socialflow");

    expect(resolveAuthsContextFromRequest(new Request("https://mentorias.drako.systems/socialflow", {
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

  it("fails closed for malformed mentorias tokens", async () => {
    process.env.MENTORIAS_AUTHS_SECRET = "mentorias_test_secret_0987654321";

    const rejected = await verifyAuthsSessionToken("bad.header.payload", "mentorias");

    expect(rejected).toBeNull();
  });
});
