import { describe, expect, it } from "vitest";

import {
  AUTHS_COOKIE_CONFIGS,
  AUTHS_COOKIE_MAX_AGE_SECONDS,
  getAuthsCookieConfig,
  getAuthsCookieName,
  readCookieFromHeader,
} from "@/lib/auths";

describe("auths cookies contract", () => {
  it("keeps canonical naming stable per context through the public barrel", () => {
    expect(getAuthsCookieName("drakos")).toBe("__Host-drakos_session");
    expect(getAuthsCookieName("mentorias")).toBe("__Host-mentorias_session");
    expect(getAuthsCookieName("socialflow")).toBe("__Host-socialflow_session");
    expect(getAuthsCookieName("bases")).toBe("__Host-bases_session");
  });

  it("keeps canonical cookie config stable for every context", () => {
    expect(getAuthsCookieConfig("drakos")).toEqual({
      cookieName: "__Host-drakos_session",
      cookiePath: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
      maxAgeSeconds: AUTHS_COOKIE_MAX_AGE_SECONDS,
    });
    expect(getAuthsCookieConfig("mentorias")).toEqual({
      cookieName: "__Host-mentorias_session",
      cookiePath: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
      maxAgeSeconds: AUTHS_COOKIE_MAX_AGE_SECONDS,
    });
    expect(getAuthsCookieConfig("socialflow")).toEqual({
      cookieName: "__Host-socialflow_session",
      cookiePath: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
      maxAgeSeconds: AUTHS_COOKIE_MAX_AGE_SECONDS,
    });
    expect(getAuthsCookieConfig("bases")).toEqual({
      cookieName: "__Host-bases_session",
      cookiePath: "/",
      sameSite: "lax",
      secure: true,
      httpOnly: true,
      maxAgeSeconds: AUTHS_COOKIE_MAX_AGE_SECONDS,
    });
  });

  it("exposes an immutable canonical cookie map", () => {
    expect(Object.isFrozen(AUTHS_COOKIE_CONFIGS)).toBe(true);
    expect(Object.isFrozen(AUTHS_COOKIE_CONFIGS.drakos)).toBe(true);
    expect(Object.keys(AUTHS_COOKIE_CONFIGS)).toEqual(["drakos", "mentorias", "socialflow", "bases"]);
  });

  it("keeps compatibility helpers available without making them part of the canonical naming surface", () => {
    const value = readCookieFromHeader(
      "__Host-drakos_session=token_a; __Host-mentorias_session=token_b",
      "__Host-mentorias_session",
    );

    expect(value).toBe("token_b");
  });
});
