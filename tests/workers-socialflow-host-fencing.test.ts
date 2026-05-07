import { describe, expect, it } from "vitest";

import { createWorkersHandlers, parseAllowedHostNames } from "../packages/shared/workers-handlers";

function buildRequest(hostName: string): Request {
  return new Request("https://example.test/socialflow", {
    method: "GET",
    headers: {
      host: hostName,
      origin: `https://${hostName}`,
    },
  });
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text) as Record<string, unknown>;
}

describe("socialflow host fencing", () => {
  const handler = createWorkersHandlers({
    saasSlug: "socialflows",
    workerName: "saas-socialflows-prod",
    domainName: "socialflows.drako.systems",
    authsSecretName: "SOCIALFLOWS_AUTHS_SECRET",
    allSaasesSlugs: ["socialflows"],
  });

  it("SAASES_DOMAIN single value allows only plural host", async () => {
    const allowedResponse = await handler.handleRequest(buildRequest("socialflows.drako.systems"), {
      SAASES_DOMAIN: "socialflows.drako.systems",
    });
    expect(allowedResponse.status).not.toBe(403);

    const rejectedResponse = await handler.handleRequest(buildRequest("socialflow.drako.systems"), {
      SAASES_DOMAIN: "socialflows.drako.systems",
    });
    const rejectedJson = await readJson(rejectedResponse);
    expect(rejectedResponse.status).toBe(403);
    expect(rejectedJson?.errorCode).toBe("HOSTS_FENCING_REJECTED");
  });

  it("SAASES_DOMAIN comma list allows plural and canonical hosts", async () => {
    const env = { SAASES_DOMAIN: "socialflows.drako.systems,socialflow.drako.systems" };

    const pluralResponse = await handler.handleRequest(buildRequest("socialflows.drako.systems"), env);
    expect(pluralResponse.status).not.toBe(403);

    const canonicalResponse = await handler.handleRequest(buildRequest("socialflow.drako.systems"), env);
    const canonicalJson = await readJson(canonicalResponse);
    expect(canonicalResponse.status).not.toBe(403);
    expect(canonicalJson?.errorCode).not.toBe("HOSTS_FENCING_REJECTED");
  });

  it("rejects unauthorized hosts", async () => {
    const response = await handler.handleRequest(buildRequest("evil.example.com"), {
      SAASES_DOMAIN: "socialflows.drako.systems,socialflow.drako.systems",
    });
    const payload = await readJson(response);

    expect(response.status).toBe(403);
    expect(payload?.errorCode).toBe("HOSTS_FENCING_REJECTED");
    expect(payload?.requestedHostName).toBe("evil.example.com");
  });

  it("normalizes SAASES_DOMAIN values with spaces and protocol", () => {
    const allowedHostNames = parseAllowedHostNames(
      " https://socialflows.drako.systems/ ,\n socialflow.drako.systems ",
      [],
    );
    expect(allowedHostNames).toEqual(["socialflows.drako.systems", "socialflow.drako.systems"]);
  });

  it("does not allow wildcard hosts", async () => {
    const allowedHostNames = parseAllowedHostNames("*.drako.systems,socialflows.drako.systems", []);
    expect(allowedHostNames).toEqual(["socialflows.drako.systems"]);

    const canonicalResponse = await handler.handleRequest(buildRequest("socialflow.drako.systems"), {
      SAASES_DOMAIN: "*.drako.systems, socialflows.drako.systems",
    });
    const canonicalJson = await readJson(canonicalResponse);
    expect(canonicalResponse.status).toBe(403);
    expect(canonicalJson?.errorCode).toBe("HOSTS_FENCING_REJECTED");
  });
});
