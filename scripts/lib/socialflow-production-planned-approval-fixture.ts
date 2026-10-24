import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const FIXTURE_ENV_VAR = "SOCIALFLOW_PRODUCTION_PLANNED_APPROVAL_FIXTURE";

const INVALID_PLACEHOLDER_PATTERNS = [
  /^required_manual_configuration$/i,
  /^todo$/i,
  /^tbd$/i,
  /^pending$/i,
  /^changeme$/i,
] as const;

const TOKEN_LEAKAGE_PATTERNS = [
  /\b(access|refresh)_token\b/i,
  /\bauthorization\s*:\s*bearer\b/i,
  /\bset-cookie\b/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
] as const;

export interface SocialflowProductionPlannedApprovalFixture {
  approvalId: string;
  rollbackPlanId: string;
  onCallOwner: string;
  productionWindowId: string;
  productionBaseUrl: string;
  expectedHost: string;
  healthPath: string;
  readinessPath: string;
  monitoringPlanId: string;
  smokeSequenceId: string;
  abortCriteriaId: string;
  humanApprovalRecorded: boolean;
  plannedOnly: true;
  productionTouchAllowed: false;
}

export type PlannedApprovalPresence = "PRESENT" | "MISSING" | "FIXTURE";
export type RedactedValue = "REDACTED" | "MISSING";

export interface RedactedPlannedApprovalField {
  presence: PlannedApprovalPresence;
  value: RedactedValue;
}

export interface SocialflowPlannedApprovalFixtureResolution {
  fixtureMode: boolean;
  fixturePath?: string;
  fixture: SocialflowProductionPlannedApprovalFixture | null;
  productionTouchAllowed: false;
}

function isConfiguredValue(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return false;
  }

  return !INVALID_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertStringField(record: Record<string, unknown>, key: string, fixturePath: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid SocialFlow planned approval fixture at ${fixturePath}: missing ${key}.`);
  }
  return value.trim();
}

function assertBooleanField(record: Record<string, unknown>, key: string, fixturePath: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") {
    throw new Error(`Invalid SocialFlow planned approval fixture at ${fixturePath}: missing ${key}.`);
  }
  return value;
}

function validateSafeFixtureValue(label: string, value: string): void {
  if (TOKEN_LEAKAGE_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new Error(`Invalid SocialFlow planned approval fixture: ${label} contains sensitive-looking content.`);
  }
}

function validateFixtureShape(record: unknown, fixturePath: string): SocialflowProductionPlannedApprovalFixture {
  if (!isStringRecord(record)) {
    throw new Error(`Invalid SocialFlow planned approval fixture at ${fixturePath}: expected JSON object.`);
  }

  const approvalId = assertStringField(record, "approvalId", fixturePath);
  const rollbackPlanId = assertStringField(record, "rollbackPlanId", fixturePath);
  const onCallOwner = assertStringField(record, "onCallOwner", fixturePath);
  const productionWindowId = assertStringField(record, "productionWindowId", fixturePath);
  const productionBaseUrl = assertStringField(record, "productionBaseUrl", fixturePath);
  const expectedHost = assertStringField(record, "expectedHost", fixturePath);
  const healthPath = assertStringField(record, "healthPath", fixturePath);
  const readinessPath = assertStringField(record, "readinessPath", fixturePath);
  const monitoringPlanId = assertStringField(record, "monitoringPlanId", fixturePath);
  const smokeSequenceId = assertStringField(record, "smokeSequenceId", fixturePath);
  const abortCriteriaId = assertStringField(record, "abortCriteriaId", fixturePath);
  const humanApprovalRecorded = assertBooleanField(record, "humanApprovalRecorded", fixturePath);
  const plannedOnly = assertBooleanField(record, "plannedOnly", fixturePath);
  const productionTouchAllowed = assertBooleanField(record, "productionTouchAllowed", fixturePath);

  if (plannedOnly !== true) {
    throw new Error(`Invalid SocialFlow planned approval fixture at ${fixturePath}: plannedOnly must be true.`);
  }
  if (productionTouchAllowed !== false) {
    throw new Error(
      `Invalid SocialFlow planned approval fixture at ${fixturePath}: productionTouchAllowed must be false.`,
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(productionBaseUrl);
  } catch {
    throw new Error(
      `Invalid SocialFlow planned approval fixture at ${fixturePath}: productionBaseUrl must be a valid https URL.`,
    );
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error(
      `Invalid SocialFlow planned approval fixture at ${fixturePath}: productionBaseUrl must use https.`,
    );
  }
  if (!parsedUrl.hostname.endsWith(".invalid")) {
    throw new Error(
      `Invalid SocialFlow planned approval fixture at ${fixturePath}: productionBaseUrl must use a .invalid host.`,
    );
  }
  if (expectedHost !== parsedUrl.hostname) {
    throw new Error(
      `Invalid SocialFlow planned approval fixture at ${fixturePath}: expectedHost must match productionBaseUrl.`,
    );
  }
  if (!expectedHost.endsWith(".invalid")) {
    throw new Error(
      `Invalid SocialFlow planned approval fixture at ${fixturePath}: expectedHost must use a .invalid host.`,
    );
  }
  if (!healthPath.startsWith("/")) {
    throw new Error(
      `Invalid SocialFlow planned approval fixture at ${fixturePath}: healthPath must be a relative path.`,
    );
  }
  if (!readinessPath.startsWith("/")) {
    throw new Error(
      `Invalid SocialFlow planned approval fixture at ${fixturePath}: readinessPath must be a relative path.`,
    );
  }

  [
    ["approvalId", approvalId],
    ["rollbackPlanId", rollbackPlanId],
    ["onCallOwner", onCallOwner],
    ["productionWindowId", productionWindowId],
    ["productionBaseUrl", productionBaseUrl],
    ["expectedHost", expectedHost],
    ["healthPath", healthPath],
    ["readinessPath", readinessPath],
    ["monitoringPlanId", monitoringPlanId],
    ["smokeSequenceId", smokeSequenceId],
    ["abortCriteriaId", abortCriteriaId],
  ].forEach(([label, value]) => validateSafeFixtureValue(label, value));

  return {
    approvalId,
    rollbackPlanId,
    onCallOwner,
    productionWindowId,
    productionBaseUrl,
    expectedHost,
    healthPath,
    readinessPath,
    monitoringPlanId,
    smokeSequenceId,
    abortCriteriaId,
    humanApprovalRecorded,
    plannedOnly: true,
    productionTouchAllowed: false,
  };
}

function resolveFixturePath(explicitFixturePath?: string): string | undefined {
  const candidate = explicitFixturePath ?? process.env[FIXTURE_ENV_VAR];
  if (!candidate) {
    return undefined;
  }

  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function loadSocialflowPlannedApprovalFixture(
  explicitFixturePath?: string,
): SocialflowPlannedApprovalFixtureResolution {
  const fixturePath = resolveFixturePath(explicitFixturePath);

  if (!fixturePath) {
    return {
      fixtureMode: false,
      fixture: null,
      productionTouchAllowed: false,
    };
  }

  const absolutePath = path.resolve(process.cwd(), fixturePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`SocialFlow planned approval fixture not found: ${fixturePath}`);
  }

  const raw = readFileSync(absolutePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const fixture = validateFixtureShape(parsed, fixturePath);

  return {
    fixtureMode: true,
    fixturePath: absolutePath,
    fixture,
    productionTouchAllowed: false,
  };
}

export function resolvePlannedApprovalField(
  envValue: string | undefined,
  fixtureValue: string | undefined,
  fixtureMode: boolean,
): RedactedPlannedApprovalField {
  const value = fixtureMode ? fixtureValue : envValue;
  const present = isConfiguredValue(value);

  return {
    presence: present ? (fixtureMode ? "FIXTURE" : "PRESENT") : "MISSING",
    value: present ? "REDACTED" : "MISSING",
  };
}

