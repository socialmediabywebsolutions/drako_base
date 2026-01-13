import type { D1Database } from "@cloudflare/workers-types";
import type {
  ProjectDomainRecord,
  ProjectEntitlementsRecord,
  ProjectRecord,
} from "@/lib/projects/repository";
import * as sessionModule from "@/lib/auth/session";
import * as cfModule from "@/lib/cf";
import * as domainVerifierModule from "@/lib/empire/domain-verifier";

export type DbAdapter = {
  run: (sql: string, ...params: unknown[]) => Promise<boolean>;
  queryOne: <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
  queryAll: <T>(sql: string, ...params: unknown[]) => Promise<T[]>;
};

type SessionModuleMutable = {
  requireTenantAccess: typeof sessionModule.requireTenantAccess;
  UnauthorizedError: typeof sessionModule.UnauthorizedError;
};

type CfModuleMutable = {
  env: typeof cfModule.env;
};

type DomainVerifierMutable = {
  verifyProjectDomain: typeof domainVerifierModule.verifyProjectDomain;
};

const sessionMutable = sessionModule as unknown as SessionModuleMutable;
const cfMutable = cfModule as unknown as CfModuleMutable;
const domainVerifierMutable = domainVerifierModule as unknown as DomainVerifierMutable;

const ORIGINAL_REQUIRE_TENANT_ACCESS = sessionMutable.requireTenantAccess;
const ORIGINAL_ENV = cfMutable.env;
const ORIGINAL_VERIFY_PROJECT_DOMAIN = domainVerifierMutable.verifyProjectDomain;

type ProjectDomainVerificationStub = {
  tenantId: string;
  projectId: string;
  domain: string;
  result: Awaited<ReturnType<typeof domainVerifierModule.verifyProjectDomain>>;
};

const verificationStubs: ProjectDomainVerificationStub[] = [];

function normalizeSql(sql: string) {
  return sql.replace(/\s+/g, " ").trim().toLowerCase();
}

function domainKey(tenantId: string, domain: string) {
  return `${tenantId}::${domain}`;
}

export class ProjectsDbMock {
  projects = new Map<string, ProjectRecord>();
  slugIndex = new Map<string, ProjectRecord>();
  domains: ProjectDomainRecord[] = [];
  entitlements = new Map<string, ProjectEntitlementsRecord>();
  domainIndex = new Map<string, ProjectDomainRecord>();
  lastQuery: { sql: string; params: unknown[] } | null = null;

  projectKey(tenantId: string, projectId: string) {
    return `${tenantId}::${projectId}`;
  }

  slugKey(tenantId: string, slug: string) {
    return `${tenantId}::slug::${slug}`;
  }

  seedProject(record: ProjectRecord) {
    this.projects.set(this.projectKey(record.tenant_id, record.id), record);
    this.slugIndex.set(this.slugKey(record.tenant_id, record.slug), record);
  }

  seedDomain(record: ProjectDomainRecord) {
    this.domains.push(record);
    this.domainIndex.set(domainKey(record.tenant_id, record.domain), record);
  }

  seedEntitlements(record: ProjectEntitlementsRecord) {
    this.entitlements.set(this.projectKey(record.tenant_id, record.project_id), record);
  }

  async run(sql: string, ...params: unknown[]) {
    this.lastQuery = { sql, params };
    const normalized = normalizeSql(sql);

    if (normalized.includes("insert into projects")) {
      const [id, tenantId, companyId, name, slug, createdAt, updatedAt] = params as [
        string,
        string,
        string | null,
        string,
        string,
        string,
        string,
      ];
      const record: ProjectRecord = {
        id,
        tenant_id: tenantId,
        company_id: companyId ?? null,
        name,
        slug,
        status: "active",
        created_at: createdAt,
        updated_at: updatedAt,
      };
      this.projects.set(this.projectKey(tenantId, id), record);
      this.slugIndex.set(this.slugKey(tenantId, slug), record);
      return true;
    }

    if (normalized.includes("insert into project_domains")) {
      const [id, tenantId, projectId, domain, status, verificationToken, lastError, createdAt, updatedAt] = params as [
        string,
        string,
        string,
        string,
        string,
        string | null,
        string | null,
        string,
        string,
      ];
      const key = domainKey(tenantId, domain);
      if (this.domainIndex.has(key)) {
        throw new Error("SQLITE_CONSTRAINT: domain already exists");
      }
      const record: ProjectDomainRecord = {
        id,
        tenant_id: tenantId,
        project_id: projectId,
        domain,
        status,
        verification_token: verificationToken,
        last_error: lastError,
        created_at: createdAt,
        updated_at: updatedAt,
      };
      this.domains.push(record);
      this.domainIndex.set(key, record);
      return true;
    }

    if (normalized.includes("update project_domains set status")) {
      const [status, lastError, verificationToken, updatedAt, id, tenantId] = params as [
        string,
        string | null,
        string | null,
        string,
        string,
        string,
      ];
      const record = this.domains.find((domain) => domain.id === id && domain.tenant_id === tenantId);
      if (record) {
        record.status = status;
        record.last_error = lastError ?? null;
        record.verification_token = verificationToken ?? null;
        record.updated_at = updatedAt;
        this.domainIndex.set(domainKey(record.tenant_id, record.domain), record);
      }
      return true;
    }

    if (normalized.includes("insert into project_entitlements") && normalized.includes("on conflict")) {
      const [tenantId, projectId, packsJson, featuresJson, limitsJson, metadataJson, updatedAt] = params as [
        string,
        string,
        string,
        string,
        string,
        string | null,
        string,
      ];
      const key = this.projectKey(tenantId, projectId);
      this.entitlements.set(key, {
        tenant_id: tenantId,
        project_id: projectId,
        packs_json: packsJson ?? "[]",
        features_json: featuresJson ?? "[]",
        limits_json: limitsJson ?? "{}",
        metadata_json: metadataJson ?? null,
        updated_at: updatedAt ?? new Date().toISOString(),
      });
      return true;
    }

    if (normalized.includes("insert or ignore into project_entitlements")) {
      const [tenantId, projectId, packsJson, featuresJson, updatedAt] = (params.length === 5
        ? (params as [string, string, string, string, string])
        : (params as [string, string, string])).concat([]) as unknown as [
        string,
        string,
        string,
        string,
        string,
      ];
      const safeUpdatedAt = updatedAt ?? new Date().toISOString();
      const key = this.projectKey(tenantId, projectId);
      this.entitlements.set(key, {
        tenant_id: tenantId,
        project_id: projectId,
        packs_json: packsJson ?? "[]",
        features_json: featuresJson ?? "[]",
        limits_json: "{}",
        metadata_json: null,
        updated_at: safeUpdatedAt,
      });
      return true;
    }

    throw new Error(`Unsupported SQL: ${sql}`);
  }

  async queryOne<T>(sql: string, ...params: unknown[]) {
    this.lastQuery = { sql, params };
    const normalized = normalizeSql(sql);

    if (normalized.includes("count(1) as count")) {
      const [tenantId, slug] = params as [string, string];
      const exists = this.slugIndex.has(this.slugKey(tenantId, slug));
      return ({ count: exists ? 1 : 0 } as unknown) as T;
    }

    if (normalized.includes("from projects")) {
      const [tenantId, projectId] = params as [string, string];
      return (this.projects.get(this.projectKey(tenantId, projectId)) as unknown) as T | null;
    }

    if (normalized.includes("from project_domains")) {
      if (normalized.includes("domain = ?") && params.length === 2) {
        const [tenantId, domain] = params as [string, string];
        return (this.domainIndex.get(domainKey(tenantId, domain)) as unknown) as T | null;
      }
      if (normalized.includes("project_id = ?") && normalized.includes("domain = ?")) {
        const [tenantId, projectId, domain] = params as [string, string, string];
        return (this.domains.find(
          (record) => record.tenant_id === tenantId && record.project_id === projectId && record.domain === domain,
        ) as unknown) as T | null;
      }
      if (normalized.includes("id = ?")) {
        const [tenantId, id] = params as [string, string];
        return (this.domains.find((record) => record.tenant_id === tenantId && record.id === id) as unknown) as T | null;
      }
    }

    if (normalized.includes("from project_entitlements")) {
      const [tenantId, projectId] = params as [string, string];
      return (this.entitlements.get(this.projectKey(tenantId, projectId)) as unknown) as T | null;
    }

    if (normalized.includes("from saas")) {
      const [tenantId, id] = params as [string, string];
      const project = this.projects.get(this.projectKey(tenantId, id));
      if (!project) return null;
      return ({ id: project.id, slug: project.slug } as unknown) as T;
    }

    return null;
  }

  async queryAll<T>(sql: string, ...params: unknown[]) {
    this.lastQuery = { sql, params };
    const normalized = normalizeSql(sql);

    if (normalized.includes("from projects")) {
      const [tenantId, maybeCompany] = params as [string, string?];
      let results = Array.from(this.projects.values()).filter((project) => project.tenant_id === tenantId);
      if (normalized.includes("company_id = ?") && typeof maybeCompany === "string") {
        results = results.filter((project) => project.company_id === maybeCompany);
      }
      if (normalized.includes("order by")) {
        results.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      }
      return results as unknown as T[];
    }

    if (normalized.includes("from project_domains")) {
      if (params.length === 2 && !normalized.includes("project_id = ?")) {
        const [tenantId, domain] = params as [string, string];
        const record = this.domainIndex.get(domainKey(tenantId, domain));
        return (record ? [record] : []) as unknown as T[];
      }

      const [tenantId, projectId, maybeStatus] = params as [string, string, string?];
      let results = this.domains.filter((domain) => domain.tenant_id === tenantId && domain.project_id === projectId);
      if (normalized.includes("lower(status) = ?") && typeof maybeStatus === "string") {
        results = results.filter((domain) => domain.status.toLowerCase() === maybeStatus.toLowerCase());
      }
      if (normalized.includes("order by")) {
        results = results.slice().sort((a, b) => a.domain.localeCompare(b.domain));
      }
      return results as unknown as T[];
    }

    if (normalized.includes("from project_entitlements")) {
      const [tenantId, projectId] = params as [string, string];
      const key = this.projectKey(tenantId, projectId);
      const record = this.entitlements.get(key);
      return record ? ([record] as unknown as T[]) : ([] as unknown as T[]);
    }

    return [];
  }
}

export function installDbMocks(mock: ProjectsDbMock) {
  type FakeStatement = {
    bind: (...params: unknown[]) => FakeStatement;
    all: <T>() => Promise<{ results: T[] }>;
    first: <T>() => Promise<T | null>;
    raw: () => Promise<unknown[]>;
    run: () => Promise<{ success: boolean }>;
  };

  const createStatement = (sql: string, boundParams: unknown[] = []): FakeStatement => {
    return {
      bind: (...params: unknown[]) => createStatement(sql, params),
      all: async <T>() => {
        const results = await mock.queryAll<T>(sql, ...boundParams);
        return { results };
      },
      first: async <T>() => {
        const row = await mock.queryOne<T>(sql, ...boundParams);
        return row ?? null;
      },
      raw: async () => {
        const results = await mock.queryAll(sql, ...boundParams);
        return results as unknown[];
      },
      run: async () => {
        const success = await mock.run(sql, ...boundParams);
        return { success };
      },
    };
  };

  const fakeDb = {
    prepare(sql: string) {
      return createStatement(sql);
    },
  } as unknown as D1Database;

  cfMutable.env = () => ({ DRACO_DB: fakeDb, SESSION_SECRET: "dummy" });
}

export function installRequireTenantAccessMock(tenantId: string, options?: { error?: Error }) {
  sessionMutable.requireTenantAccess = async () => {
    if (options?.error) throw options.error;
    return {
      tenantId,
      session: { email: "demo@drako.systems", tenantId, role: "admin", issuedAt: Date.now() },
    };
  };
}

export function resetModuleStubs() {
  sessionMutable.requireTenantAccess = ORIGINAL_REQUIRE_TENANT_ACCESS;
  cfMutable.env = ORIGINAL_ENV;
  domainVerifierMutable.verifyProjectDomain = ORIGINAL_VERIFY_PROJECT_DOMAIN;
  verificationStubs.length = 0;
}

export function createRequest(url: string, init?: RequestInit) {
  return new Request(url, {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
}

export function stubProjectDomainVerification(stub: ProjectDomainVerificationStub) {
  verificationStubs.push({
    ...stub,
    domain: stub.domain.trim().toLowerCase(),
  });
  domainVerifierMutable.verifyProjectDomain = async (params: Parameters<typeof domainVerifierModule.verifyProjectDomain>[0]) => {
    const match = verificationStubs.find(
      (candidate) =>
        candidate.tenantId === params.tenantId &&
        candidate.projectId === params.projectId &&
        candidate.domain === params.hostname.trim().toLowerCase(),
    );
    if (match) {
      return match.result;
    }
    return ORIGINAL_VERIFY_PROJECT_DOMAIN(params);
  };
}
