import { describe, expect, it } from "vitest";

import {
  resolveAuthsContextFromHost,
  resolveAuthsContextFromPath,
  resolveAuthsContextFromRequest,
  resolveAuthsLoginPath,
} from "@/lib/auths";

describe("auths contexts contract", () => {
  it("keeps canonical host resolution stable", () => {
    expect(resolveAuthsContextFromHost("drako.systems")).toBe("drakos");
    expect(resolveAuthsContextFromHost("mentorias.drako.systems")).toBe("mentorias");
    expect(resolveAuthsContextFromHost("app.socialflow.example.com")).toBe("socialflow");
    expect(resolveAuthsContextFromHost("admin.drako.systems")).toBe("bases");
    expect(resolveAuthsContextFromHost(null)).toBe("drakos");
  });

  it("keeps canonical path resolution stable for known auth surfaces", () => {
    expect(resolveAuthsContextFromPath("/api/drakos/auths/logins")).toBe("drakos");
    expect(resolveAuthsContextFromPath("/api/mentorias/auths/logins")).toBe("mentorias");
    expect(resolveAuthsContextFromPath("/api/socialflow/auths/logins")).toBe("socialflow");
    expect(resolveAuthsContextFromPath("/bases/login")).toBe("bases");
    expect(resolveAuthsContextFromPath("/some/unknown/path")).toBeNull();
  });

  it("keeps canonical request resolution stable and lets auth paths override host context", () => {
    const mentoriaApiRequest = new Request("https://drako.systems/api/mentorias/auths/logins", {
      headers: { host: "drako.systems" },
    });
    const socialWorkspaceRequest = new Request("https://app.socialflow.example.com/socialflow", {
      headers: { host: "app.socialflow.example.com" },
    });
    const basesRequest = new Request("https://bases.drako.systems/socialflow", {
      headers: { host: "bases.drako.systems" },
    });

    expect(resolveAuthsContextFromRequest(mentoriaApiRequest)).toBe("mentorias");
    expect(resolveAuthsContextFromRequest(socialWorkspaceRequest)).toBe("socialflow");
    expect(resolveAuthsContextFromRequest(basesRequest)).toBe("bases");
  });

  it("keeps login path resolution stable for each context", () => {
    expect(resolveAuthsLoginPath("drakos")).toBe("/drakos/auths/logins");
    expect(resolveAuthsLoginPath("mentorias")).toBe("/mentorias/auths/logins");
    expect(resolveAuthsLoginPath("socialflow")).toBe("/socialflow/auth");
    expect(resolveAuthsLoginPath("bases")).toBe("/bases/login");
  });

  it("keeps local override compatibility without making it the canonical signal", () => {
    const request = new Request("https://localhost:3000/auth/login?__drako_host=mentorias.drako.systems", {
      headers: { host: "localhost:3000" },
    });

    expect(resolveAuthsContextFromRequest(request)).toBe("mentorias");
  });
});
