#!/usr/bin/env node

/*
  SOCIALFLOW_CANONICAL_HOST_EXPECTED=socialflow.drako.systems
  SOCIALFLOW_COMPAT_HOST_EXPECTED=socialflows.drako.systems
  SOCIALFLOW_CANONICAL_ROUTE=/socialflow
  SOCIALFLOW_CANONICAL_API_ROUTE=/api/socialflow/profile
*/

const ENABLED = process.env.SOCIALFLOW_CANONICAL_SMOKE_ENABLED === "1";
const CANONICAL_HOST = (process.env.SOCIALFLOW_CANONICAL_HOST ?? "").trim();
const COMPAT_HOST = (process.env.SOCIALFLOW_COMPAT_HOST ?? "socialflows.drako.systems").trim();
const CANONICAL_HOST_HEADER = (process.env.SOCIALFLOW_CANONICAL_HOST_HEADER ?? "").trim();
const COMPAT_HOST_HEADER = (process.env.SOCIALFLOW_COMPAT_HOST_HEADER ?? "").trim();
const TIMEOUT_MS = Number(process.env.SOCIALFLOW_CANONICAL_SMOKE_TIMEOUT_MS ?? "8000");

const checks = [
  {
    id: "canonical-root",
    method: "GET",
    path: "/",
    expectedStatuses: [200, 301, 302, 307, 308],
  },
  {
    id: "canonical-socialflow-route",
    method: "GET",
    path: "/socialflow",
    expectedStatuses: [200, 301, 302, 307, 308, 401, 403],
  },
  {
    id: "canonical-socialflow-auth",
    method: "GET",
    path: "/socialflow/auth",
    expectedStatuses: [200, 301, 302, 307, 308, 401, 403],
  },
  {
    id: "canonical-socialflow-profile-ui",
    method: "GET",
    path: "/socialflow/profile",
    expectedStatuses: [200, 301, 302, 307, 308, 401, 403],
  },
  {
    id: "canonical-socialflow-ai-ui",
    method: "GET",
    path: "/socialflow/ai",
    expectedStatuses: [200, 301, 302, 307, 308, 401, 403],
  },
  {
    id: "canonical-socialflow-profile",
    method: "GET",
    path: "/api/socialflow/profile",
    expectedStatuses: [200, 401, 403],
  },
  {
    id: "canonical-socialflow-campaigns",
    method: "GET",
    path: "/api/socialflow/campaigns?saasId=socialflow",
    expectedStatuses: [200, 401, 403],
  },
  {
    id: "canonical-socialflow-posts",
    method: "GET",
    path: "/api/socialflow/posts?saasId=socialflow",
    expectedStatuses: [200, 401, 403],
  },
  {
    id: "legacy-social-posts-410",
    method: "GET",
    path: "/api/social/posts",
    expectedStatuses: [410],
  },
  {
    id: "legacy-linkedin-publish-410",
    method: "GET",
    path: "/api/social/linkedin/publish",
    expectedStatuses: [410],
  },
  {
    id: "canonical-linkedin-connect-redirect",
    method: "GET",
    path: "/api/socialflow/linkedin/connect?saasId=smoke-socialflow&tenantId=smoke-tenant",
    expectedStatuses: [302, 303, 307, 401, 403],
    validateLocation: (location) =>
      location == null ||
      (typeof location === "string" &&
        location.includes("linkedin.com") &&
        location.includes(encodeURIComponent("/api/socialflow/linkedin/callback"))),
  },
  {
    id: "operator-not-public",
    method: "GET",
    path: "/operator/socialflow",
    expectedStatuses: [302, 307, 308, 401, 403],
  },
];

const forbiddenPlaceholderTokens = [
  "Solicitar piloto",
  "Acceso cliente: pr",
  "Convierte tu operaci",
  "SocialFlow ayuda a planificar",
  "SocialFlow Control Room",
];

function normalizeHostToBaseUrl(host) {
  if (host.startsWith("http://") || host.startsWith("https://")) {
    return host.replace(/\/+$/, "");
  }
  return `https://${host.replace(/\/+$/, "")}`;
}

function printNoopPlan() {
  console.log("[SOCIALFLOW_CANONICAL_SMOKE] no-op mode.");
  console.log("Set SOCIALFLOW_CANONICAL_SMOKE_ENABLED=1 to execute HTTP checks.");
  console.log("Set SOCIALFLOW_CANONICAL_HOST=<host> explicitly when enabling.");
  console.log("Planned checks:");
  console.log("- GET https://socialflow.drako.systems/");
  console.log("- GET https://socialflow.drako.systems/socialflow");
  console.log("- GET https://socialflow.drako.systems/socialflow/auth");
  console.log("- GET https://socialflow.drako.systems/socialflow/profile");
  console.log("- GET https://socialflow.drako.systems/socialflow/ai");
  console.log("- GET https://socialflow.drako.systems/api/socialflow/profile");
  console.log("- GET https://socialflow.drako.systems/api/social/posts (expect 410)");
  console.log("- GET https://socialflow.drako.systems/api/social/linkedin/publish (expect 410)");
  console.log("- GET https://socialflow.drako.systems/api/socialflow/linkedin/connect (expect redirect to LinkedIn)");
  console.log("- GET https://socialflow.drako.systems/operator/socialflow (must not be public)");
  console.log("- GET https://socialflows.drako.systems/socialflow (compat/legacy evidence)");
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function reportPass(id, status, url) {
  console.log(`[PASS] ${id} ${status} ${url}`);
}

function reportFail(id, status, url, reason) {
  console.error(`[FAIL] ${id} ${status} ${url} ${reason}`);
}

function buildRequestHeaders(baseUrl, hostHeader = "") {
  const headers = {
    "user-agent": "drako-socialflow-canonical-smoke/1.0",
    origin: hostHeader ? `https://${hostHeader}` : baseUrl,
  };

  if (!hostHeader) {
    return headers;
  }

  return {
    ...headers,
    host: hostHeader,
    "x-forwarded-host": hostHeader,
  };
}

async function assertNoPlaceholderHtml(check, response, url) {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    return null;
  }

  const body = await response.text();
  for (const token of forbiddenPlaceholderTokens) {
    if (body.includes(token)) {
      return `placeholder token detected: ${token}`;
    }
  }

  const authMarkers = ["SocialFlow secure access", "Secure access", "Continue to SocialFlow"];
  if (check.id === "canonical-socialflow-auth" && !authMarkers.some((marker) => body.includes(marker))) {
    return "auth route did not render the SocialFlow auth page";
  }

  return null;
}

async function runCanonicalChecks(baseUrl) {
  let failed = false;
  for (const check of checks) {
    const url = `${baseUrl}${check.path}`;
    try {
      const response = await fetchWithTimeout(url, {
        method: check.method,
        redirect: "manual",
        headers: buildRequestHeaders(baseUrl, CANONICAL_HOST_HEADER),
      });
      const ok = check.expectedStatuses.includes(response.status);
      if (!ok) {
        reportFail(
          check.id,
          response.status,
          url,
          `expected one of [${check.expectedStatuses.join(", ")}]`,
        );
        failed = true;
        continue;
      }

      if (check.validateLocation) {
        const location = response.headers.get("location");
        if (!check.validateLocation(location)) {
          reportFail(
            check.id,
            response.status,
            url,
            `unexpected location=${location ?? "null"}`,
          );
          failed = true;
          continue;
        }
      }

      const placeholderViolation = await assertNoPlaceholderHtml(check, response, url);
      if (placeholderViolation) {
        reportFail(check.id, response.status, url, placeholderViolation);
        failed = true;
        continue;
      }

      reportPass(check.id, response.status, url);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      reportFail(check.id, "ERR", url, reason);
      failed = true;
    }
  }
  return failed;
}

async function runCompatibilityCheck(canonicalBaseUrl) {
  if (!COMPAT_HOST) return false;

  const compatBaseUrl = normalizeHostToBaseUrl(COMPAT_HOST);
  const compatUrl = `${compatBaseUrl}/socialflow`;
  try {
    const response = await fetchWithTimeout(compatUrl, {
      method: "GET",
      redirect: "manual",
      headers: buildRequestHeaders(compatBaseUrl, COMPAT_HOST_HEADER || COMPAT_HOST.replace(/^https?:\/\//, "")),
    });

    const accepted = [200, 301, 302, 307, 308, 401, 403];
    if (!accepted.includes(response.status)) {
      reportFail(
        "compat-socialflows-host",
        response.status,
        compatUrl,
        `expected one of [${accepted.join(", ")}]`,
      );
      return true;
    }

    const placeholderViolation = await assertNoPlaceholderHtml(
      { id: "compat-socialflows-host" },
      response,
      compatUrl,
    );
    if (placeholderViolation) {
      reportFail("compat-socialflows-host", response.status, compatUrl, placeholderViolation);
      return true;
    }

    const location = response.headers.get("location");
    if (location && location.includes(canonicalBaseUrl)) {
      reportPass("compat-socialflows-host", response.status, `${compatUrl} -> ${location}`);
    } else {
      reportPass("compat-socialflows-host", response.status, compatUrl);
    }
    return false;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    reportFail("compat-socialflows-host", "ERR", compatUrl, reason);
    return true;
  }
}

async function main() {
  if (!ENABLED) {
    printNoopPlan();
    process.exit(0);
  }

  if (!CANONICAL_HOST) {
    console.error(
      "SOCIALFLOW_CANONICAL_SMOKE_ENABLED=1 requires SOCIALFLOW_CANONICAL_HOST=<host> (for example: socialflow.drako.systems).",
    );
    process.exit(1);
  }

  const canonicalBaseUrl = normalizeHostToBaseUrl(CANONICAL_HOST);
  console.log(`[SOCIALFLOW_CANONICAL_SMOKE] running against ${canonicalBaseUrl}`);

  const canonicalFailed = await runCanonicalChecks(canonicalBaseUrl);
  const compatFailed = await runCompatibilityCheck(canonicalBaseUrl);
  const failed = canonicalFailed || compatFailed;

  if (failed) {
    console.error("[SOCIALFLOW_CANONICAL_SMOKE] FAILED");
    process.exit(1);
  }

  console.log("[SOCIALFLOW_CANONICAL_SMOKE] PASSED");
}

main().catch((error) => {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`[SOCIALFLOW_CANONICAL_SMOKE] fatal error: ${reason}`);
  process.exit(1);
});
