import { consumeRateLimit, createInMemoryRateLimitStore } from "../src/lib/security/rate-limit";
import { verifyPublicIngestAccess, registerPublicIngestFailure } from "../src/lib/security/public-ingest";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function testRateLimit() {
  const store = createInMemoryRateLimitStore();
  const key = "public:/api/health:127.0.0.1";
  const windowMs = 60_000;
  const limit = 2;

  const first = await consumeRateLimit({ key, windowMs, limit, store });
  const second = await consumeRateLimit({ key, windowMs, limit, store });
  const third = await consumeRateLimit({ key, windowMs, limit, store });

  assert(first.allowed, "first request should be allowed");
  assert(second.allowed, "second request should be allowed");
  assert(!third.allowed, "third request should be blocked");
}

async function testPublicIngestSignature() {
  const request = new Request("http://localhost/api/site/clinic/leads", {
    method: "POST",
    headers: {
      "x-drako-ingest-token": "wrong-token",
      "x-forwarded-for": "10.0.0.1",
    },
    body: JSON.stringify({ slug: "demo", name: "Test" }),
  });

  const verification = await verifyPublicIngestAccess({
    request,
    tenantId: "demo-tenant",
    saasId: "demo-saas",
    bodyText: JSON.stringify({ slug: "demo", name: "Test" }),
    credential: {
      id: "cred_demo",
      tenant_id: "demo-tenant",
      saas_id: "demo-saas",
      token: "valid-token",
      hmac_secret: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    signatureRequired: true,
    signatureMode: "token",
  });

  assert(!verification.ok, "invalid token should be rejected");

  const okRequest = new Request("http://localhost/api/site/clinic/leads", {
    method: "POST",
    headers: {
      "x-forwarded-for": "10.0.0.2",
    },
    body: JSON.stringify({ slug: "demo", name: "Test" }),
  });

  const okVerification = await verifyPublicIngestAccess({
    request: okRequest,
    tenantId: "demo-tenant",
    saasId: "demo-saas",
    bodyText: JSON.stringify({ slug: "demo", name: "Test" }),
    signatureRequired: false,
  });

  assert(okVerification.ok, "token should be optional when signatureRequired=false");
}

async function testPublicIngestEvents() {
  const events: Array<{ type: string }> = [];
  const actions: Array<{ title: string }> = [];
  const request = new Request("http://localhost/api/site/clinic/leads", {
    method: "POST",
    headers: {
      "x-forwarded-for": "10.0.0.3",
    },
  });

  for (let i = 0; i < 10; i += 1) {
    await registerPublicIngestFailure({
      request,
      tenantId: "demo-tenant",
      saasId: "demo-saas",
      saasSlug: "demo",
      route: "/api/site/clinic/leads",
      reason: "invalid_token",
      correlationId: `corr_${i}`,
      recordEvent: async (input) => {
        events.push({ type: input.type });
      },
      enqueueAction: async (input) => {
        actions.push({ title: input.title });
      },
    });
  }

  assert(events.length >= 10, "should emit events for invalid signatures");
  assert(actions.length >= 1, "should enqueue action on repeated abuse");
}

async function main() {
  await testRateLimit();
  await testPublicIngestSignature();
  await testPublicIngestEvents();
  console.log("Public surface fixtures: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
