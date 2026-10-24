/// <reference types="@cloudflare/workers-types" />

const BACKOFF_SECONDS = [30, 120, 600, 1800];

export type CampamentoEventSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export type CampamentoEventInput = {
  tenantId: string;
  saasId?: string | null;
  type: string;
  severity: CampamentoEventSeverity;
  source: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  correlationId: string;
  createdAt?: string;
};

export type HostnamePollPayload = {
  type: "domains.hostname.poll";
  domainId: string;
  tenantId: string;
  saasId: string;
  domain: string;
  sslStatus: "pending" | "active" | "error";
  sslReason?: string;
  attempt?: number;
  correlationId?: string;
  idempotencyKey?: string;
  v?: 1;
};

export type HostnameCreatePayload = {
  type: "domains.hostname.create";
  domainId: string;
  tenantId: string;
  saasId: string;
  domain: string;
  correlationId?: string;
  idempotencyKey?: string;
  v?: 1;
};

export type HostnameDeletePayload = {
  type: "domains.hostname.delete";
  domainId: string;
  tenantId: string;
  saasId: string;
  domain: string;
  correlationId?: string;
  idempotencyKey?: string;
  v?: 1;
};

export type HostnameQueueMessage = HostnamePollPayload | HostnameCreatePayload | HostnameDeletePayload;

export type DomainsRepository = {
  findById(domainId: string): Promise<DomainRecord | null>;
  markActivated(params: ActivateDomainInput): Promise<void>;
  markPending(params: MarkPendingInput): Promise<void>;
  markFailed(params: MarkFailedInput): Promise<void>;
};

export type CampamentoEventsRecorder = (input: CampamentoEventInput) => Promise<void>;

export type DomainRecord = {
  id: string;
  tenant_id: string;
  saas_id: string;
  domain: string;
  status: string;
  verification_status: string | null;
  verification_reason: string | null;
  retry_count: number | null;
  last_checked_at: string | null;
  updated_at: string | null;
};

export type ActivateDomainInput = {
  domainId: string;
  correlationId: string;
  now: string;
};

export type MarkPendingInput = {
  domainId: string;
  correlationId: string;
  now: string;
  retryCount: number;
  nextRetrySeconds: number;
  reason?: string;
};

export type MarkFailedInput = {
  domainId: string;
  correlationId: string;
  now: string;
  reason: string;
};

export type ProcessHostnameResult =
  | { outcome: "activated"; correlationId: string; domain: string }
  | { outcome: "pending"; nextRetrySeconds: number; correlationId: string; domain: string }
  | { outcome: "noop"; correlationId: string; domain: string }
  | { outcome: "failed"; correlationId: string; domain: string; reason: string };

export function createDomainsRepository(db: D1Database): DomainsRepository {
  return {
    async findById(domainId) {
      const stmt = db.prepare(
        `SELECT id, tenant_id, saas_id, domain, status, verification_status, verification_reason, retry_count, last_checked_at, updated_at
         FROM saas_domains WHERE id = ? LIMIT 1`,
      );
      const result = await stmt.bind(domainId).all<DomainRecord>();
      return (result.results ?? [])[0] ?? null;
    },
    async markActivated(params) {
      const stmt = db.prepare(
        `UPDATE saas_domains
         SET status = 'active', verification_status = 'verified', verification_reason = NULL,
             retry_count = 0, last_checked_at = ?, updated_at = ?
         WHERE id = ?`,
      );
      await stmt.bind(params.now, params.now, params.domainId).run();
    },
    async markPending(params) {
      const stmt = db.prepare(
        `UPDATE saas_domains
         SET status = 'pending', verification_status = CASE WHEN verification_status IS NULL THEN 'dns_pending' ELSE verification_status END,
             verification_reason = ?, retry_count = ?, last_checked_at = ?, updated_at = ?
         WHERE id = ?`,
      );
      await stmt.bind(params.reason ?? null, params.retryCount, params.now, params.now, params.domainId).run();
    },
    async markFailed(params) {
      const stmt = db.prepare(
        `UPDATE saas_domains
         SET status = 'pending', verification_status = 'failed', verification_reason = ?, last_checked_at = ?, updated_at = ?
         WHERE id = ?`,
      );
      await stmt.bind(params.reason, params.now, params.now, params.domainId).run();
    },
  };
}

export function createCampamentoEventsRecorder(db: D1Database): CampamentoEventsRecorder {
  return async function record(input) {
    const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
    const stmt = db.prepare(
      `INSERT INTO campamento_events (id, tenant_id, saas_id, type, severity, source, message, metadata, correlation_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    await stmt
      .bind(
        generateId("event"),
        input.tenantId,
        input.saasId ?? null,
        input.type,
        input.severity,
        input.source,
        input.message,
        metadata,
        input.correlationId,
        input.createdAt ?? new Date().toISOString(),
      )
      .run();
  };
}

export function generateId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.();
  if (random) return random;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export function generateCorrelationId(): string {
  return generateId("corr");
}

export async function processHostnameMessage(
  message: HostnameQueueMessage,
  deps: {
    repo: DomainsRepository;
    recordEvent: CampamentoEventsRecorder;
    now?: () => Date;
  },
): Promise<ProcessHostnameResult> {
  if (message.type !== "domains.hostname.poll") {
    return { outcome: "noop", correlationId: message.correlationId ?? generateCorrelationId(), domain: message.domain };
  }

  const correlationId = message.correlationId ?? generateCorrelationId();
  const timestamp = deps.now ? deps.now() : new Date();
  const nowIso = timestamp.toISOString();

  const domain = await deps.repo.findById(message.domainId);
  if (!domain) {
    await deps.recordEvent({
      tenantId: message.tenantId,
      saasId: message.saasId,
      type: "domains.hostname.failed",
      severity: "ERROR",
      source: "AUTOPILOT_WORKER",
      message: `Hostname ${message.domain} not found during poll`,
      metadata: { domainId: message.domainId, sslStatus: message.sslStatus },
      correlationId,
    });
    return { outcome: "failed", correlationId, domain: message.domain, reason: "DOMAIN_NOT_FOUND" };
  }

  const normalizedStatus = domain.status?.trim().toLowerCase();
  const normalizedVerification = domain.verification_status?.trim().toLowerCase();

  if (message.sslStatus === "active") {
    if (normalizedStatus === "active" && normalizedVerification === "verified") {
      await deps.recordEvent({
        tenantId: domain.tenant_id,
        saasId: domain.saas_id,
        type: "domains.hostname.ssl_active",
        severity: "INFO",
        source: "AUTOPILOT_WORKER",
        message: `Hostname ${domain.domain} already active`,
        metadata: { domainId: domain.id, duplicate: true },
        correlationId,
      });
      return { outcome: "noop", correlationId, domain: domain.domain };
    }

    await deps.repo.markActivated({ domainId: domain.id, correlationId, now: nowIso });

    await deps.recordEvent({
      tenantId: domain.tenant_id,
      saasId: domain.saas_id,
      type: "domains.hostname.ssl_active",
      severity: "INFO",
      source: "AUTOPILOT_WORKER",
      message: `Hostname ${domain.domain} SSL active detected`,
      metadata: { domainId: domain.id },
      correlationId,
    });

    await deps.recordEvent({
      tenantId: domain.tenant_id,
      saasId: domain.saas_id,
      type: "domains.activated",
      severity: "INFO",
      source: "AUTOPILOT_WORKER",
      message: `Domain ${domain.domain} activated`,
      metadata: { domainId: domain.id },
      correlationId,
    });

    return { outcome: "activated", correlationId, domain: domain.domain };
  }

  if (message.sslStatus === "pending") {
    const attempt = typeof message.attempt === "number" ? message.attempt : domain.retry_count ?? 0;
    const nextRetrySeconds = BACKOFF_SECONDS[Math.min(attempt, BACKOFF_SECONDS.length - 1)];
    const nextRetryCount = attempt + 1;

    await deps.repo.markPending({
      domainId: domain.id,
      correlationId,
      now: nowIso,
      retryCount: nextRetryCount,
      nextRetrySeconds,
      reason: message.sslReason ?? "SSL_PENDING",
    });

    await deps.recordEvent({
      tenantId: domain.tenant_id,
      saasId: domain.saas_id,
      type: "domains.hostname.pending",
      severity: "WARNING",
      source: "AUTOPILOT_WORKER",
      message: `Hostname ${domain.domain} still pending SSL`,
      metadata: { domainId: domain.id, retryCount: nextRetryCount, nextRetrySeconds },
      correlationId,
    });

    return { outcome: "pending", nextRetrySeconds, correlationId, domain: domain.domain };
  }

  const reason = message.sslReason ?? "SSL_ERROR";
  await deps.repo.markFailed({ domainId: domain.id, correlationId, now: nowIso, reason });

  await deps.recordEvent({
    tenantId: domain.tenant_id,
    saasId: domain.saas_id,
    type: "domains.hostname.ssl_failed",
    severity: "ERROR",
    source: "AUTOPILOT_WORKER",
    message: `Hostname ${domain.domain} SSL failure`,
    metadata: { domainId: domain.id, reason },
    correlationId,
  });

  return { outcome: "failed", correlationId, domain: domain.domain, reason };
}
