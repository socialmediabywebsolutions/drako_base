import "./register-paths";
import { strict as assert } from "node:assert";
import { listCompanyDomains } from "@/lib/company-domains/domains";

async function testListCompanyDomainsTenantOnlyFilter(): Promise<void> {
  const rows: unknown[] = [];
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = async <T>(sql: string, ...params: unknown[]): Promise<T[]> => {
    calls.push({ sql, params });
    return rows as unknown as T[];
  };

  const result = await listCompanyDomains("tenant_only", {}, query);
  assert.equal(calls.length, 1, "listCompanyDomains should execute a single query");
  assert.deepEqual(calls[0]!.params, ["tenant_only"], "Only tenant id should be bound when no filters provided");
  assert.ok(/WHERE tenant_id = \?/i.test(calls[0]!.sql), "Query should filter by tenant_id");
  assert.strictEqual(result, rows, "listCompanyDomains should pass through query results");
}

async function testListCompanyDomainsStatusOrdering(): Promise<void> {
  const rows = [
    { id: "dom_a", tenant_id: "tenant_x", company_id: "comp_x", domain: "one.example", status: "pending", verification_status: null, verification_reason: null, retry_count: 1, last_checked_at: null, created_at: "2025-01-02T00:00:00Z", updated_at: null },
  ];
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = async <T>(sql: string, ...params: unknown[]): Promise<T[]> => {
    calls.push({ sql, params });
    return rows as unknown as T[];
  };

  await listCompanyDomains("tenant_x", { status: "pending" }, query);
  const normalized = calls[0]!.sql.replace(/\s+/g, " ").trim();
  assert.match(normalized, /ORDER BY \(updated_at IS NULL\).*domain ASC$/i, "Ordering must mirror compat expectations");
  assert.deepEqual(calls[0]!.params, ["tenant_x", "pending"], "Status filter should bind as second parameter");
}

async function run() {
  const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [
    { name: "listCompanyDomains binds tenant only by default", fn: testListCompanyDomainsTenantOnlyFilter },
    { name: "listCompanyDomains preserves ordering with status filter", fn: testListCompanyDomainsStatusOrdering },
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

  console.log("✅ All company domains tests passed");
}

run().catch((error) => {
  console.error("❌ Unexpected test runner failure");
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
