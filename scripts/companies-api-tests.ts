import "./register-paths";
import { strict as assert } from "node:assert";
import { listCompanies } from "@/lib/companies/companies";
import { listCompanyDomains, listCompanyDomainsForCompany } from "@/lib/company-domains/domains";
import {
  buildInboxQuery,
  resolveInboxCompanyAlias,
  enrichInboxItemsWithCompany,
  type InboxMessage,
} from "@/lib/inbox/helpers";

async function testListCompaniesUsesProvidedQuery(): Promise<void> {
  const sample = [
    { id: "core_acc", slug: "contabilidad", name: "Contabilidad", description: "Finance", created_at: null },
    { id: "core_dev", slug: "programacion", name: "Programación", description: "Dev", created_at: null },
  ];
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = async <T>(sql: string, ...params: unknown[]): Promise<T[]> => {
    calls.push({ sql, params });
    return sample as unknown as T[];
  };

  const result = await listCompanies(query);
  assert.equal(calls.length, 1, "listCompanies should execute a single query");
  assert.match(calls[0]!.sql, /SELECT id, slug, name, description, created_at FROM companies/i);
  assert.deepEqual(calls[0]!.params, [], "listCompanies should not bind params for compat view");
  assert.deepEqual(result, sample, "listCompanies should return query results unmodified");
}

async function testCompanyDomainsDetailHelperBindsCompanyId(): Promise<void> {
  const rows = [
    {
      id: "dom_2",
      tenant_id: "tenant_b",
      company_id: "comp_b",
      domain: "example.org",
      status: "pending",
      verification_status: null,
      verification_reason: null,
      retry_count: null,
      last_checked_at: null,
      created_at: "2025-01-05T00:00:00Z",
      updated_at: null,
    },
  ];
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = async <T>(sql: string, ...params: unknown[]): Promise<T[]> => {
    calls.push({ sql, params });
    return rows as unknown as T[];
  };

  const result = await listCompanyDomainsForCompany("tenant_b", "comp_b", query);
  assert.equal(calls.length, 1, "listCompanyDomainsForCompany should execute a single query");
  const executedSql = calls[0]!.sql.replace(/\s+/g, " ").trim();
  assert.match(executedSql, /FROM company_domains/i);
  assert.match(executedSql, /WHERE tenant_id = \? AND company_id = \?/i);
  assert.deepEqual(calls[0]!.params, ["tenant_b", "comp_b"], "Helper should bind tenant and company id only");
  assert.deepEqual(result, rows, "Helper should return query results");
}

async function testListCompanyDomainsFiltersAndOrdering(): Promise<void> {
  const rows = [
    {
      id: "dom_1",
      tenant_id: "tenant_a",
      company_id: "comp_a",
      domain: "example.com",
      status: "active",
      verification_status: "verified",
      verification_reason: null,
      retry_count: 0,
      last_checked_at: "2025-01-01T00:00:00Z",
      created_at: "2024-12-01T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
    },
  ];
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = async <T>(sql: string, ...params: unknown[]): Promise<T[]> => {
    calls.push({ sql, params });
    return rows as unknown as T[];
  };

  const result = await listCompanyDomains("tenant_a", { companyId: "comp_a", status: "active" }, query);
  assert.equal(calls.length, 1, "listCompanyDomains should execute a single query");
  const executedSql = calls[0]!.sql.replace(/\s+/g, " ").trim();
  assert.match(executedSql, /WHERE tenant_id = \? AND company_id = \? AND status = \?/i);
  assert.match(executedSql, /ORDER BY \(updated_at IS NULL\).*domain ASC$/i);
  assert.deepEqual(calls[0]!.params, ["tenant_a", "comp_a", "active"], "Filters should bind tenant, company, and status parameters in order");
  assert.deepEqual(result, rows, "listCompanyDomains should return query results");
}

function testInboxQuerySupportsCompanyAlias(): void {
  const { sql, params } = buildInboxQuery({ tenantId: "tenant_a", saasId: "company_123", channel: null, status: null, departmentId: null });
  assert.match(sql, /tenant_id = \?/i, "Query must always filter by tenant_id");
  assert.match(sql, /saas_id = \?/i, "Query must include saas_id filter when provided");
  assert.deepEqual(params, ["tenant_a", "company_123"], "Params should include tenant first, then company alias");
}

function testInboxCompanyAliasResolution(): void {
  assert.equal(resolveInboxCompanyAlias({ saas_id: "saas_a", company_id: "company_b" }), "saas_a", "saas_id takes precedence when both provided");
  assert.equal(resolveInboxCompanyAlias({ company_id: "company_b" }), "company_b", "company_id should be used when saas_id missing");
  assert.equal(resolveInboxCompanyAlias({}), null, "Missing identifiers should resolve to null");
}

function testInboxEnrichmentAddsCompanyId(): void {
  const messages: InboxMessage[] = [
    {
      id: "msg_1",
      channel: "email",
      direction: "inbound",
      from_address: "a@example.com",
      to_address: "b@example.com",
      subject: "Hola",
      body_preview: "Hola",
      full_body: "Hola mundo",
      status: "nuevo",
      saas_id: "saas_a",
      department_id: null,
      tags: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  const enriched = enrichInboxItemsWithCompany(messages);
  assert.equal(enriched[0]!.company_id, "saas_a", "company_id alias should mirror saas_id");
}

async function run() {
  const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [
    { name: "listCompanies issues expected query", fn: testListCompaniesUsesProvidedQuery },
    { name: "listCompanyDomains filters tenant/company/status", fn: testListCompanyDomainsFiltersAndOrdering },
    { name: "listCompanyDomainsForCompany binds tenant + company", fn: testCompanyDomainsDetailHelperBindsCompanyId },
    { name: "buildInboxQuery handles company alias", fn: testInboxQuerySupportsCompanyAlias },
    { name: "resolveInboxCompanyAlias handles precedence", fn: testInboxCompanyAliasResolution },
    { name: "enrichInboxItemsWithCompany adds company_id field", fn: testInboxEnrichmentAddsCompanyId },
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

  console.log("✅ All companies compatibility tests passed");
}

run().catch((error) => {
  console.error("❌ Unexpected test runner failure");
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
