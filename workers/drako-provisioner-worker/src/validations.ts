type ValidationResults<T> = { ok: true; value: T } | { ok: false; errorMessage: string };

const UUID_PATTERNS = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERNS = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EVENT_TYPE_PATTERNS = /^[a-z0-9]+([._-][a-z0-9]+)+$/;

type GovernanceSeverities = "info" | "warn" | "error" | "critical";

export type GovernanceEventSpecsV1 = {
  event_id: string;
  event_type: string;
  source: string;
  saas_slug: string | null;
  tenant_id: string | null;
  actor_type: string;
  actor_id: string;
  severity: GovernanceSeverities;
  occurred_at: string;
  metadata: Record<string, unknown>;
  trace_id: string;
  correlation_id: string;
  schema_version: "v1";
};

export type ProvisionSaasesPlanPayloads = {
  saasId: string;
  saasSlug: string;
  displayName: string;
  ownerTenantId: string | null;
  domainName: string | null;
  actorType: string;
  actorId: string;
  traceId: string;
  correlationId: string;
};

export type ProvisionSaasesApplyPayloads = ProvisionSaasesPlanPayloads & {
  workerName: string;
};

function readRequiredStrings(body: Record<string, unknown>, key: string, minLength = 1, maxLength = 256): string {
  const value = String(body[key] ?? "").trim();
  if (value.length < minLength || value.length > maxLength) {
    throw new Error(`Invalid field '${key}'.`);
  }
  return value;
}

function readOptionalStrings(body: Record<string, unknown>, key: string, maxLength = 256): string | null {
  const rawValue = body[key];
  if (rawValue == null) return null;
  const value = String(rawValue).trim();
  if (!value) return null;
  if (value.length > maxLength) throw new Error(`Invalid field '${key}'.`);
  return value;
}

function readRequiredUuids(body: Record<string, unknown>, key: string): string {
  const value = readRequiredStrings(body, key);
  if (!UUID_PATTERNS.test(value)) {
    throw new Error(`Invalid field '${key}'.`);
  }
  return value.toLowerCase();
}

function readRequiredIsoDates(body: Record<string, unknown>, key: string): string {
  const value = readRequiredStrings(body, key, 10, 64);
  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid field '${key}'.`);
  }
  return parsedDate.toISOString();
}

function readRequiredJsonObjects(body: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = body[key];
  if (value == null) return {};
  if (!Array.isArray(value) && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    const normalizedValue = value.trim();
    if (!normalizedValue) return {};
    const parsedValue = JSON.parse(normalizedValue);
    if (!parsedValue || Array.isArray(parsedValue) || typeof parsedValue !== "object") {
      throw new Error(`Invalid field '${key}'.`);
    }
    return parsedValue as Record<string, unknown>;
  }
  throw new Error(`Invalid field '${key}'.`);
}

function validateEventTypes(eventType: string): string {
  if (!EVENT_TYPE_PATTERNS.test(eventType)) {
    throw new Error("Invalid field 'event_type'.");
  }
  return eventType;
}

export function validateGovernanceEventSpecsV1(
  body: Record<string, unknown>,
): ValidationResults<GovernanceEventSpecsV1> {
  try {
    const severity = readRequiredStrings(body, "severity");
    if (!["info", "warn", "error", "critical"].includes(severity)) {
      throw new Error("Invalid field 'severity'.");
    }

    const schemaVersion = readRequiredStrings(body, "schema_version");
    if (schemaVersion !== "v1") {
      throw new Error("Invalid field 'schema_version'.");
    }

    return {
      ok: true,
      value: {
        event_id: readRequiredUuids(body, "event_id"),
        event_type: validateEventTypes(readRequiredStrings(body, "event_type", 3, 256)),
        source: readRequiredStrings(body, "source", 2, 128),
        saas_slug: readOptionalStrings(body, "saas_slug"),
        tenant_id: readOptionalStrings(body, "tenant_id"),
        actor_type: readRequiredStrings(body, "actor_type", 2, 64),
        actor_id: readRequiredStrings(body, "actor_id", 2, 128),
        severity: severity as GovernanceSeverities,
        occurred_at: readRequiredIsoDates(body, "occurred_at"),
        metadata: readRequiredJsonObjects(body, "metadata"),
        trace_id: readRequiredStrings(body, "trace_id", 8, 128),
        correlation_id: readRequiredStrings(body, "correlation_id", 8, 128),
        schema_version: "v1",
      },
    };
  } catch (error) {
    return { ok: false, errorMessage: error instanceof Error ? error.message : "Invalid payload." };
  }
}

export function validateProvisionSaasesPlanPayloads(
  body: Record<string, unknown>,
): ValidationResults<ProvisionSaasesPlanPayloads> {
  try {
    const saasSlug = readRequiredStrings(body, "saasSlug", 2, 64).toLowerCase();
    if (!SLUG_PATTERNS.test(saasSlug)) {
      throw new Error("Invalid field 'saasSlug'.");
    }

    return {
      ok: true,
      value: {
        saasId: readRequiredStrings(body, "saasId", 2, 128),
        saasSlug,
        displayName: readRequiredStrings(body, "displayName", 2, 128),
        ownerTenantId: readOptionalStrings(body, "ownerTenantId", 128),
        domainName: readOptionalStrings(body, "domainName", 128),
        actorType: readOptionalStrings(body, "actorType", 64) ?? "system",
        actorId: readOptionalStrings(body, "actorId", 128) ?? "provisioner",
        traceId: readOptionalStrings(body, "traceId", 128) ?? crypto.randomUUID(),
        correlationId: readOptionalStrings(body, "correlationId", 128) ?? crypto.randomUUID(),
      },
    };
  } catch (error) {
    return { ok: false, errorMessage: error instanceof Error ? error.message : "Invalid payload." };
  }
}

export function validateProvisionSaasesApplyPayloads(
  body: Record<string, unknown>,
): ValidationResults<ProvisionSaasesApplyPayloads> {
  const baseValidation = validateProvisionSaasesPlanPayloads(body);
  if (baseValidation.ok === false) {
    return baseValidation;
  }

  try {
    return {
      ok: true,
      value: {
        ...baseValidation.value,
        workerName: readRequiredStrings(body, "workerName", 3, 128),
      },
    };
  } catch (error) {
    return { ok: false, errorMessage: error instanceof Error ? error.message : "Invalid payload." };
  }
}

export function buildProvisioningGovernanceEventSpecsV1(params: {
  eventType: "provisioning.plan.created" | "provisioning.apply.requested";
  source: string;
  saasSlug: string;
  tenantId: string | null;
  actorType: string;
  actorId: string;
  traceId: string;
  correlationId: string;
  metadata: Record<string, unknown>;
}): GovernanceEventSpecsV1 {
  return {
    event_id: crypto.randomUUID(),
    event_type: params.eventType,
    source: params.source,
    saas_slug: params.saasSlug,
    tenant_id: params.tenantId,
    actor_type: params.actorType,
    actor_id: params.actorId,
    severity: "info",
    occurred_at: new Date().toISOString(),
    metadata: params.metadata,
    trace_id: params.traceId,
    correlation_id: params.correlationId,
    schema_version: "v1",
  };
}
