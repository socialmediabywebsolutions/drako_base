import { strict as assert } from "node:assert";
import {
  processHostnameMessage,
  type DomainsRepository,
  type DomainRecord,
  type HostnamePollPayload,
  type CampamentoEventInput,
} from "../workers/autopilot-worker/src/hostnames";
import { mapDomainStatus, type DomainStatusInput } from "../src/lib/empire/host-status-utils";

function cloneDomain(row: Partial<DomainRecord> & { id: string; tenant_id: string; saas_id: string; domain: string }): DomainRecord {
  return {
    status: "pending",
    verification_status: null,
    verification_reason: null,
    retry_count: 0,
    last_checked_at: null,
    updated_at: null,
    ...row,
  };
}

async function testDomainGatingPending(): Promise<void> {
  const row: DomainStatusInput = {
    status: "pending",
    verification_status: null,
  };

  const result = mapDomainStatus(row);
  assert.equal(result.status, "PENDING");
  assert.equal(result.reason, "DOMAIN_NOT_ACTIVE");
}

async function testDomainGatingVerifiedButInactive(): Promise<void> {
  const row: DomainStatusInput = {
    status: "pending",
    verification_status: "verified",
  };

  const result = mapDomainStatus(row);
  assert.equal(result.status, "PENDING");
  assert.equal(result.reason, "DOMAIN_PENDING_ACTIVATION");
}

async function testDomainGatingActive(): Promise<void> {
  const row: DomainStatusInput = {
    status: "active",
    verification_status: "verified",
  };

  const result = mapDomainStatus(row);
  assert.equal(result.status, "ACTIVE");
  assert.equal(result.reason, undefined);
}

async function testPollActivatesOnce(): Promise<void> {
  const domain = cloneDomain({
    id: "dom_activate",
    tenant_id: "tenant_a",
    saas_id: "saas_a",
    domain: "activate.example.com",
    status: "pending",
    verification_status: "dns_pending",
  });

  const events: CampamentoEventInput[] = [];

  const repo: DomainsRepository = {
    async findById(domainId) {
      return domainId === domain.id ? { ...domain } : null;
    },
    async markActivated(params) {
      assert.equal(params.domainId, domain.id);
      domain.status = "active";
      domain.verification_status = "verified";
      domain.retry_count = 0;
      domain.last_checked_at = params.now;
      domain.updated_at = params.now;
    },
    async markPending() {
      throw new Error("markPending should not be called during activation");
    },
    async markFailed() {
      throw new Error("markFailed should not be called during activation");
    },
  };

  const recordEvent = async (input: CampamentoEventInput) => {
    events.push(input);
  };

  const message: HostnamePollPayload = {
    type: "domains.hostname.poll",
    domainId: domain.id,
    tenantId: domain.tenant_id,
    saasId: domain.saas_id,
    domain: domain.domain,
    sslStatus: "active",
  };

  const activateResult = await processHostnameMessage(message, { repo, recordEvent, now: () => new Date("2025-01-01T00:00:00.000Z") });
  assert.equal(activateResult.outcome, "activated");
  assert.equal(domain.status, "active");
  assert.equal(domain.verification_status, "verified");

  const activationEvents = events.filter((evt) => evt.type === "domains.activated");
  assert.equal(activationEvents.length, 1);

  const secondResult = await processHostnameMessage(message, { repo, recordEvent, now: () => new Date("2025-01-01T00:05:00.000Z") });
  assert.equal(secondResult.outcome, "noop");

  const activationEventsAfterSecondPoll = events.filter((evt) => evt.type === "domains.activated");
  assert.equal(activationEventsAfterSecondPoll.length, 1, "domains.activated should remain idempotent");
}

async function testPollPendingBackoff(): Promise<void> {
  const domain = cloneDomain({
    id: "dom_pending",
    tenant_id: "tenant_b",
    saas_id: "saas_b",
    domain: "pending.example.com",
    status: "pending",
    verification_status: "dns_pending",
    retry_count: 1,
  });

  const events: CampamentoEventInput[] = [];

  const repo: DomainsRepository = {
    async findById(domainId) {
      return domainId === domain.id ? { ...domain } : null;
    },
    async markActivated() {
      throw new Error("markActivated should not be called for pending SSL");
    },
    async markPending(params) {
      assert.equal(params.domainId, domain.id);
      domain.status = "pending";
      domain.verification_status = domain.verification_status ?? "dns_pending";
      domain.retry_count = params.retryCount;
      domain.last_checked_at = params.now;
      domain.updated_at = params.now;
    },
    async markFailed() {
      throw new Error("markFailed should not be called for pending SSL test");
    },
  };

  const recordEvent = async (input: CampamentoEventInput) => {
    events.push(input);
  };

  const message: HostnamePollPayload = {
    type: "domains.hostname.poll",
    domainId: domain.id,
    tenantId: domain.tenant_id,
    saasId: domain.saas_id,
    domain: domain.domain,
    sslStatus: "pending",
    sslReason: "CNAME_NOT_READY",
    attempt: 1,
  };

  const result = await processHostnameMessage(message, { repo, recordEvent, now: () => new Date("2025-01-01T00:10:00.000Z") });
  assert.equal(result.outcome, "pending");
  assert.equal(result.nextRetrySeconds, 120);
  assert.equal(domain.retry_count, 2);

  const pendingEvents = events.filter((evt) => evt.type === "domains.hostname.pending");
  assert.equal(pendingEvents.length, 1);
  assert.equal(pendingEvents[0]?.metadata && (pendingEvents[0].metadata as Record<string, unknown>).retryCount, 2);
}

async function run() {
  const tests: { name: string; fn: () => Promise<void> }[] = [
    { name: "Pending domains are blocked", fn: testDomainGatingPending },
    { name: "Verified but inactive domains are blocked", fn: testDomainGatingVerifiedButInactive },
    { name: "Active and verified domains are permitted", fn: testDomainGatingActive },
    { name: "Hostname poll activates domain idempotently", fn: testPollActivatesOnce },
    { name: "Hostname poll schedules retry with backoff", fn: testPollPendingBackoff },
  ];

  let failures = 0;
  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✅ ${test.name}`);
    } catch (error) {
      failures += 1;
      console.error(`❌ ${test.name}`);
      console.error(error instanceof Error ? error.stack : error);
    }
  }

  if (failures > 0) {
    console.error(`❌ Completed with ${failures} failing test(s).`);
    process.exit(1);
  }

  console.log("✅ All hostnames tests passed");
}

run().catch((error) => {
  console.error("❌ Unexpected test runner failure");
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
