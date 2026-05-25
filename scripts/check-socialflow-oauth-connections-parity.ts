import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ParityMode = "d1-local" | "fixtures";

type CoreConnectionRow = {
  connection_id: string;
  tenant_id: string;
  saas_id: string;
  integration_key: string;
  connection_label: string | null;
  status: string;
  metadata_json: string | null;
  last_validated_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
};

type CoreCredentialRow = {
  connection_id: string;
  payload_json: string | null;
};

type SocialOAuthRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  provider: string;
  external_profile_id: string;
  author_urn: string | null;
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  encrypted_id_token: string | null;
  scopes: string | null;
  expires_at: string | null;
  token_type: string | null;
  status: string;
  metadata_json: string;
  last_validated_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
};

type PreparedCoreComparable = {
  tenant_id: string;
  saas_id: string;
  provider: string;
  external_profile_id: string;
  author_urn: string | null;
  access_token_plain: string;
  refresh_token_plain: string | null;
  id_token_plain: string | null;
  scopes: string | null;
  expires_at: string | null;
  token_type: string | null;
  status: string;
  metadata_json: string;
  last_validated_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
};

type PreparedSocialComparable = Omit<PreparedCoreComparable, "access_token_plain" | "refresh_token_plain" | "id_token_plain"> & {
  access_token_plain: string;
  refresh_token_plain: string | null;
  id_token_plain: string | null;
};

type OAuthParitySummaryEntry = {
  tenant_id: string;
  saas_id: string;
  provider: string;
  external_profile_id: string;
  author_urn: string | null;
  scopes: string | null;
  expires_at: string | null;
  token_type: string | null;
  status: string;
  metadata_json: string;
  last_validated_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  access_token_fingerprint: string;
  refresh_token_fingerprint: string | null;
  id_token_fingerprint: string | null;
};

type OAuthMismatchField =
  | "external_profile_id"
  | "author_urn"
  | "access_token"
  | "refresh_token"
  | "id_token"
  | "scopes"
  | "expires_at"
  | "token_type"
  | "status"
  | "metadata_json"
  | "last_validated_at"
  | "last_error_code"
  | "last_error_message";

type OAuthParityMismatch = {
  key: string;
  fields: OAuthMismatchField[];
  core: OAuthParitySummaryEntry;
  social: OAuthParitySummaryEntry;
};

export type SocialFlowOAuthConnectionsParityReport = {
  mode: ParityMode;
  totalCore: number;
  totalSocial: number;
  matched: number;
  missingInSocial: OAuthParitySummaryEntry[];
  missingInCore: OAuthParitySummaryEntry[];
  mismatched: OAuthParityMismatch[];
};

type FixtureSchema = {
  bindings: {
    draco: boolean;
    social: boolean;
  };
  draco: {
    tables: string[];
  };
  social: {
    tables: string[];
  };
  env?: {
    socialflowTokenEncryptionSecret?: string;
  };
};

type FixtureSource = {
  connections: CoreConnectionRow[];
  credentials: CoreCredentialRow[];
};

type RunOptions = {
  configPath?: string;
  dracoBinding?: string;
  socialBinding?: string;
  fixturesDir?: string | null;
  encryptionSecret?: string | null;
  log?: (line: string) => void;
};

type ParsedArgs = {
  allowDrift: boolean;
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
  fixturesDir: string | null;
  encryptionSecret: string | null;
};

const LINKEDIN_INTEGRATION_KEY = "linkedin";
const LINKEDIN_PROVIDER = "LINKEDIN";
const REQUIRED_DRACO_TABLES = [
  "drako_integration_connections",
  "drako_integration_credentials",
] as const;
const REQUIRED_SOCIAL_TABLE = "socialflow_oauth_connections";

const FIXTURE_SCHEMA_FILE = "socialflow-oauth-backfill-schema.json";
const FIXTURE_SOURCE_FILE = "socialflow-oauth-core-source.json";
const FIXTURE_TARGET_FILE = "socialflow-oauth-connections.json";

const TOKEN_ENCRYPTION_PREFIX = "encrypted";
const TOKEN_ENCRYPTION_VERSION = "v1";
const TOKEN_ENCRYPTION_ALGORITHM = "aes-gcm";

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeProvider(value: string | null | undefined): string {
  const normalized = normalizeText(value).toUpperCase();
  return normalized.length > 0 ? normalized : LINKEDIN_PROVIDER;
}

function normalizeStatus(value: string | null | undefined): string {
  const normalized = normalizeText(value).toUpperCase();
  return normalized.length > 0 ? normalized : "PENDING_REAL";
}

function normalizeOauthStatusFromCore(input: { coreStatus: string | null | undefined; lastErrorCode: string | null | undefined }): string {
  const coreStatus = normalizeStatus(input.coreStatus);
  if (coreStatus === "CONNECTED" && !normalizeNullableString(input.lastErrorCode)) {
    return "CONNECTED_REAL";
  }
  return "PENDING_REAL";
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseProfileIdFromUrn(urn: string | null): string | null {
  if (!urn) return null;
  const normalized = urn.trim();
  if (!normalized) return null;
  const match = normalized.match(/^urn:li:person:(.+)$/i);
  if (!match) return null;
  return normalizeNullableString(match[1]);
}

function selectScope(credentials: Record<string, unknown>, metadata: Record<string, unknown>): string | null {
  const raw = credentials.scope ?? credentials.scopes ?? metadata.scope ?? metadata.scopes;
  if (Array.isArray(raw)) {
    const tokens = raw
      .map((entry) => normalizeText(entry))
      .filter((entry) => entry.length > 0);
    return tokens.length > 0 ? tokens.join(" ") : null;
  }
  return normalizeNullableString(raw);
}

function selectExpiresAt(credentials: Record<string, unknown>, updatedAt: string): string | null {
  const direct =
    normalizeNullableString(credentials.expiresAt)
    ?? normalizeNullableString(credentials.expires_at);
  if (direct) return direct;

  const expiresIn =
    parseNumeric(credentials.expiresIn)
    ?? parseNumeric(credentials.expires_in);
  if (expiresIn == null || expiresIn <= 0) return null;

  const baseTimestamp = Date.parse(updatedAt);
  if (Number.isNaN(baseTimestamp)) return null;
  return new Date(baseTimestamp + expiresIn * 1000).toISOString();
}

function stableJsonStringify(value: unknown): string {
  if (value == null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJsonStringify(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJsonStringify(record[key])}`).join(",")}}`;
}

function canonicalizeJson(value: string | null | undefined): string {
  const raw = normalizeText(value);
  if (!raw) return "";
  try {
    return stableJsonStringify(JSON.parse(raw));
  } catch {
    return raw;
  }
}

function fingerprintToken(value: string | null): string | null {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function toSummaryEntry(input: {
  tenant_id: string;
  saas_id: string;
  provider: string;
  external_profile_id: string;
  author_urn: string | null;
  access_token_plain: string;
  refresh_token_plain: string | null;
  id_token_plain: string | null;
  scopes: string | null;
  expires_at: string | null;
  token_type: string | null;
  status: string;
  metadata_json: string;
  last_validated_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
}): OAuthParitySummaryEntry {
  return {
    tenant_id: input.tenant_id,
    saas_id: input.saas_id,
    provider: input.provider,
    external_profile_id: input.external_profile_id,
    author_urn: input.author_urn,
    scopes: input.scopes,
    expires_at: input.expires_at,
    token_type: input.token_type,
    status: input.status,
    metadata_json: input.metadata_json,
    last_validated_at: input.last_validated_at,
    last_error_code: input.last_error_code,
    last_error_message: input.last_error_message,
    access_token_fingerprint: fingerprintToken(input.access_token_plain) ?? "missing",
    refresh_token_fingerprint: fingerprintToken(input.refresh_token_plain),
    id_token_fingerprint: fingerprintToken(input.id_token_plain),
  };
}

function buildKey(input: {
  tenant_id: string;
  saas_id: string;
  provider: string;
  external_profile_id: string;
}): string {
  return `${input.tenant_id}::${input.saas_id}::${input.provider.toUpperCase()}::${input.external_profile_id}`;
}

function parseJsonRows<T>(jsonOutput: string): T[] {
  const parsed = JSON.parse(jsonOutput) as Array<{ results?: T[] }>;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [];
  }
  return parsed[0]?.results ?? [];
}

function asSqlValue(value: unknown): string {
  if (value == null) return "NULL";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `'${text.replace(/'/g, "''")}'`;
}

function runWranglerJson(
  binding: string,
  sql: string,
  options: { configPath: string },
): unknown[] {
  try {
    const output = execFileSync(
      "pnpm",
      [
        "wrangler",
        "d1",
        "execute",
        binding,
        "--local",
        "--config",
        options.configPath,
        "--command",
        sql,
        "--json",
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    return parseJsonRows(output);
  } catch (error) {
    const commandError = error as { stderr?: string | Buffer; message?: string };
    const stderr = typeof commandError.stderr === "string"
      ? commandError.stderr
      : commandError.stderr instanceof Buffer
        ? commandError.stderr.toString("utf8")
        : commandError.message ?? String(error);
    throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_WRANGLER_JSON_FAILED:${stderr.trim()}`);
  }
}

function assertTableExists(rows: Array<{ name?: string }>, tableName: string): void {
  if (!rows.some((row) => row.name === tableName)) {
    throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_TABLE_MISSING:${tableName}`);
  }
}

function assertFixturesReady(schema: FixtureSchema): void {
  if (!schema.bindings.draco) {
    throw new Error("SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_BINDING_MISSING:DRACO_DB");
  }
  if (!schema.bindings.social) {
    throw new Error("SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_BINDING_MISSING:SOCIAL_DB");
  }

  for (const table of REQUIRED_DRACO_TABLES) {
    if (!schema.draco.tables.includes(table)) {
      throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_TABLE_MISSING:${table}`);
    }
  }
  if (!schema.social.tables.includes(REQUIRED_SOCIAL_TABLE)) {
    throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_TABLE_MISSING:${REQUIRED_SOCIAL_TABLE}`);
  }
}

function base64Encode(buffer: ArrayBuffer): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(buffer).toString("base64");
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Decode(base64: string): ArrayBuffer {
  if (typeof Buffer !== "undefined") {
    const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function deriveEncryptionKey(secret: string): Promise<CryptoKey> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_WEBCRYPTO_UNAVAILABLE");
  }
  const encoder = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"],
  );
  return globalThis.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("socialflow-token-encryption-salt-v1"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function isEncryptedTokenValue(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith(`${TOKEN_ENCRYPTION_PREFIX}:${TOKEN_ENCRYPTION_VERSION}:${TOKEN_ENCRYPTION_ALGORITHM}:`);
}

async function decryptTokenWithSecret(secret: string, encrypted: string): Promise<string> {
  const parts = encrypted.split(":");
  if (parts.length !== 5) {
    throw new Error("SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_TOKEN_FORMAT_INVALID");
  }
  const [prefix, version, algorithm, ivBase64, ciphertextBase64] = parts;
  if (prefix !== TOKEN_ENCRYPTION_PREFIX || version !== TOKEN_ENCRYPTION_VERSION || algorithm !== TOKEN_ENCRYPTION_ALGORITHM) {
    throw new Error("SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_TOKEN_FORMAT_UNSUPPORTED");
  }
  const key = await deriveEncryptionKey(secret);
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64Decode(ivBase64) },
    key,
    base64Decode(ciphertextBase64),
  );
  return new TextDecoder().decode(plaintext);
}

function resolveParityEncryptionSecret(options: {
  optionsSecret?: string | null;
  fixtureSecret?: string | null;
}): string {
  const candidate = normalizeText(
    options.optionsSecret
    ?? options.fixtureSecret
    ?? process.env.SOCIALFLOW_TOKEN_ENCRYPTION_SECRET,
  );
  if (!candidate) {
    throw new Error("SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_ENCRYPTION_SECRET_MISSING");
  }
  if (candidate.length < 32) {
    throw new Error("SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_ENCRYPTION_SECRET_TOO_SHORT");
  }
  return candidate;
}

async function normalizeTokenPlain(value: string | null, options: {
  optionsSecret?: string | null;
  fixtureSecret?: string | null;
}): Promise<string | null> {
  const token = normalizeNullableString(value);
  if (!token) return null;
  if (!isEncryptedTokenValue(token)) return token;
  const secret = resolveParityEncryptionSecret(options);
  return decryptTokenWithSecret(secret, token);
}

function selectLatestLinkedinConnections(rows: CoreConnectionRow[]): CoreConnectionRow[] {
  const sorted = [...rows]
    .filter((row) => normalizeText(row.integration_key).toLowerCase() === LINKEDIN_INTEGRATION_KEY)
    .sort((a, b) => {
      const keyA = `${normalizeText(a.tenant_id)}::${normalizeText(a.saas_id)}`;
      const keyB = `${normalizeText(b.tenant_id)}::${normalizeText(b.saas_id)}`;
      if (keyA !== keyB) return keyA.localeCompare(keyB);
      const updatedA = normalizeText(a.updated_at);
      const updatedB = normalizeText(b.updated_at);
      if (updatedA === updatedB) return normalizeText(b.connection_id).localeCompare(normalizeText(a.connection_id));
      return updatedB.localeCompare(updatedA);
    });

  const selected = new Map<string, CoreConnectionRow>();
  for (const row of sorted) {
    const tenantId = normalizeText(row.tenant_id);
    const saasId = normalizeText(row.saas_id);
    if (!tenantId || !saasId) continue;
    const key = `${tenantId}::${saasId}`;
    if (!selected.has(key)) {
      selected.set(key, row);
    }
  }

  return [...selected.values()];
}

async function buildCoreComparableRows(input: {
  connections: CoreConnectionRow[];
  credentials: CoreCredentialRow[];
  optionsSecret?: string | null;
  fixtureSecret?: string | null;
}): Promise<PreparedCoreComparable[]> {
  const credentialsByConnection = new Map<string, CoreCredentialRow>();
  for (const credential of input.credentials) {
    credentialsByConnection.set(normalizeText(credential.connection_id), credential);
  }

  const selectedConnections = selectLatestLinkedinConnections(input.connections);
  const result: PreparedCoreComparable[] = [];

  for (const connection of selectedConnections) {
    const tenantId = normalizeText(connection.tenant_id);
    const saasId = normalizeText(connection.saas_id);
    const credential = credentialsByConnection.get(normalizeText(connection.connection_id));
    if (!credential) {
      throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_CREDENTIALS_MISSING:${tenantId}::${saasId}`);
    }

    const credentials = parseJsonObject(credential.payload_json);
    const metadata = parseJsonObject(connection.metadata_json);

    const authorUrn =
      normalizeNullableString(credentials.authorUrn)
      ?? normalizeNullableString(credentials.author_urn)
      ?? normalizeNullableString(metadata.authorUrn)
      ?? normalizeNullableString(metadata.author_urn)
      ?? null;

    const profileId =
      normalizeNullableString(credentials.profileId)
      ?? normalizeNullableString(credentials.profile_id)
      ?? normalizeNullableString(credentials.externalProfileId)
      ?? normalizeNullableString(credentials.external_profile_id)
      ?? normalizeNullableString(metadata.profileId)
      ?? normalizeNullableString(metadata.profile_id)
      ?? normalizeNullableString(metadata.externalProfileId)
      ?? normalizeNullableString(metadata.external_profile_id)
      ?? parseProfileIdFromUrn(authorUrn);

    if (!profileId) {
      throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_PROFILE_ID_MISSING:${tenantId}::${saasId}`);
    }

    const accessTokenRaw =
      normalizeNullableString(credentials.accessToken)
      ?? normalizeNullableString(credentials.access_token);
    if (!accessTokenRaw) {
      throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_ACCESS_TOKEN_MISSING:${tenantId}::${saasId}`);
    }

    const refreshTokenRaw =
      normalizeNullableString(credentials.refreshToken)
      ?? normalizeNullableString(credentials.refresh_token);
    const idTokenRaw =
      normalizeNullableString(credentials.idToken)
      ?? normalizeNullableString(credentials.id_token);

    const accessTokenPlain = await normalizeTokenPlain(accessTokenRaw, input);
    if (!accessTokenPlain) {
      throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_ACCESS_TOKEN_EMPTY:${tenantId}::${saasId}`);
    }

    const refreshTokenPlain = await normalizeTokenPlain(refreshTokenRaw, input);
    const idTokenPlain = await normalizeTokenPlain(idTokenRaw, input);
    const canonicalAuthorUrn = authorUrn ?? `urn:li:person:${profileId}`;
    const metadataJson = canonicalizeJson(
      JSON.stringify({
        mode: "live",
        provider: "LINKEDIN",
        profileId,
        authorUrn: canonicalAuthorUrn,
        displayName: normalizeNullableString(metadata.displayName),
        email: normalizeNullableString(metadata.email),
        picture: metadata.picture ?? null,
        locale: metadata.locale ?? null,
        source: "core_backfill",
      }),
    );

    result.push({
      tenant_id: tenantId,
      saas_id: saasId,
      provider: LINKEDIN_PROVIDER,
      external_profile_id: profileId,
      author_urn: canonicalAuthorUrn,
      access_token_plain: accessTokenPlain,
      refresh_token_plain: refreshTokenPlain,
      id_token_plain: idTokenPlain,
      scopes: selectScope(credentials, metadata),
      expires_at: selectExpiresAt(credentials, connection.updated_at),
      token_type:
        normalizeNullableString(credentials.tokenType)
        ?? normalizeNullableString(credentials.token_type),
      status: normalizeOauthStatusFromCore({
        coreStatus: connection.status,
        lastErrorCode: connection.last_error_code,
      }),
      metadata_json: metadataJson,
      last_validated_at:
        normalizeNullableString(connection.last_validated_at)
        ?? normalizeNullableString(connection.updated_at),
      last_error_code: normalizeNullableString(connection.last_error_code),
      last_error_message: normalizeNullableString(connection.last_error_message),
    });
  }

  return result.sort((a, b) => buildKey(a).localeCompare(buildKey(b)));
}

async function buildSocialComparableRows(input: {
  socialRows: SocialOAuthRow[];
  optionsSecret?: string | null;
  fixtureSecret?: string | null;
}): Promise<PreparedSocialComparable[]> {
  const comparable: PreparedSocialComparable[] = [];
  for (const row of input.socialRows) {
    const provider = normalizeProvider(row.provider);
    if (provider !== LINKEDIN_PROVIDER) continue;
    const tenantId = normalizeText(row.tenant_id);
    const saasId = normalizeText(row.saas_id);
    const externalProfileId = normalizeText(row.external_profile_id);
    if (!tenantId || !saasId || !externalProfileId) continue;

    const accessTokenPlain = await normalizeTokenPlain(row.encrypted_access_token, input);
    if (!accessTokenPlain) {
      throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_SOCIAL_ACCESS_TOKEN_MISSING:${tenantId}::${saasId}`);
    }

    comparable.push({
      tenant_id: tenantId,
      saas_id: saasId,
      provider,
      external_profile_id: externalProfileId,
      author_urn: normalizeNullableString(row.author_urn),
      access_token_plain: accessTokenPlain,
      refresh_token_plain: await normalizeTokenPlain(row.encrypted_refresh_token, input),
      id_token_plain: await normalizeTokenPlain(row.encrypted_id_token, input),
      scopes: normalizeNullableString(row.scopes),
      expires_at: normalizeNullableString(row.expires_at),
      token_type: normalizeNullableString(row.token_type),
      status: normalizeStatus(row.status),
      metadata_json: canonicalizeJson(row.metadata_json),
      last_validated_at: normalizeNullableString(row.last_validated_at),
      last_error_code: normalizeNullableString(row.last_error_code),
      last_error_message: normalizeNullableString(row.last_error_message),
    });
  }

  return comparable.sort((a, b) => buildKey(a).localeCompare(buildKey(b)));
}

function buildMismatch(core: PreparedCoreComparable, social: PreparedSocialComparable): OAuthParityMismatch | null {
  const fields: OAuthMismatchField[] = [];
  if (core.external_profile_id !== social.external_profile_id) fields.push("external_profile_id");
  if (core.author_urn !== social.author_urn) fields.push("author_urn");
  if (core.access_token_plain !== social.access_token_plain) fields.push("access_token");
  if (core.refresh_token_plain !== social.refresh_token_plain) fields.push("refresh_token");
  if (core.id_token_plain !== social.id_token_plain) fields.push("id_token");
  if (core.scopes !== social.scopes) fields.push("scopes");
  if (core.expires_at !== social.expires_at) fields.push("expires_at");
  if (core.token_type !== social.token_type) fields.push("token_type");
  if (core.status !== social.status) fields.push("status");
  if (core.metadata_json !== social.metadata_json) fields.push("metadata_json");
  if (core.last_validated_at !== social.last_validated_at) fields.push("last_validated_at");
  if (core.last_error_code !== social.last_error_code) fields.push("last_error_code");
  if (core.last_error_message !== social.last_error_message) fields.push("last_error_message");
  if (fields.length === 0) return null;
  return {
    key: buildKey(core),
    fields,
    core: toSummaryEntry(core),
    social: toSummaryEntry(social),
  };
}

function buildParityReport(
  coreRows: PreparedCoreComparable[],
  socialRows: PreparedSocialComparable[],
  mode: ParityMode,
): SocialFlowOAuthConnectionsParityReport {
  const coreMap = new Map<string, PreparedCoreComparable>();
  const socialMap = new Map<string, PreparedSocialComparable>();

  for (const row of coreRows) {
    coreMap.set(buildKey(row), row);
  }
  for (const row of socialRows) {
    socialMap.set(buildKey(row), row);
  }

  const missingInSocial: OAuthParitySummaryEntry[] = [];
  const missingInCore: OAuthParitySummaryEntry[] = [];
  const mismatched: OAuthParityMismatch[] = [];
  let matched = 0;

  for (const [key, core] of coreMap.entries()) {
    const social = socialMap.get(key);
    if (!social) {
      missingInSocial.push(toSummaryEntry(core));
      continue;
    }
    const mismatch = buildMismatch(core, social);
    if (mismatch) {
      mismatched.push(mismatch);
    } else {
      matched += 1;
    }
  }

  for (const [key, social] of socialMap.entries()) {
    if (!coreMap.has(key)) {
      missingInCore.push(toSummaryEntry(social));
    }
  }

  return {
    mode,
    totalCore: coreMap.size,
    totalSocial: socialMap.size,
    matched,
    missingInSocial,
    missingInCore,
    mismatched,
  };
}

function hasDrift(report: SocialFlowOAuthConnectionsParityReport): boolean {
  return report.missingInSocial.length > 0 || report.missingInCore.length > 0 || report.mismatched.length > 0;
}

function summarizeEntries(entries: OAuthParitySummaryEntry[]): string {
  return entries
    .map((entry) =>
      `${entry.tenant_id}/${entry.saas_id}/${entry.provider}/${entry.external_profile_id}`
      + ` status=${entry.status} access=${entry.access_token_fingerprint}`,
    )
    .join(" | ");
}

function summarizeMismatches(entries: OAuthParityMismatch[]): string {
  return entries
    .map((entry) => `${entry.key} fields=${entry.fields.join(",")}`)
    .join(" | ");
}

function reportToConsole(report: SocialFlowOAuthConnectionsParityReport, log: (line: string) => void): void {
  log(`SOCIALFLOW_OAUTH_CONNECTIONS_PARITY mode=${report.mode}`);
  log(
    `core=${report.totalCore} social=${report.totalSocial} matched=${report.matched} missingInSocial=${report.missingInSocial.length} missingInCore=${report.missingInCore.length} mismatched=${report.mismatched.length}`,
  );
  if (report.missingInSocial.length > 0) {
    log(`missingInSocial=${summarizeEntries(report.missingInSocial)}`);
  }
  if (report.missingInCore.length > 0) {
    log(`missingInCore=${summarizeEntries(report.missingInCore)}`);
  }
  if (report.mismatched.length > 0) {
    log(`mismatched=${summarizeMismatches(report.mismatched)}`);
  }
}

function loadCoreConnections(options: { configPath: string; dracoBinding: string }): CoreConnectionRow[] {
  return runWranglerJson(
    options.dracoBinding,
    `SELECT
       c.id AS connection_id,
       c.tenant_id,
       c.saas_id,
       c.integration_key,
       c.connection_label,
       c.status,
       c.metadata_json,
       c.last_validated_at,
       c.last_error_code,
       c.last_error_message,
       c.created_at,
       c.updated_at
     FROM drako_integration_connections c
     WHERE lower(c.integration_key) = '${LINKEDIN_INTEGRATION_KEY}'
     ORDER BY c.tenant_id ASC, c.saas_id ASC, datetime(c.updated_at) DESC`,
    { configPath: options.configPath },
  ) as CoreConnectionRow[];
}

function loadCoreCredentials(options: { configPath: string; dracoBinding: string }): CoreCredentialRow[] {
  return runWranglerJson(
    options.dracoBinding,
    `SELECT connection_id, payload_json
     FROM drako_integration_credentials`,
    { configPath: options.configPath },
  ) as CoreCredentialRow[];
}

function loadSocialRows(options: { configPath: string; socialBinding: string }): SocialOAuthRow[] {
  return runWranglerJson(
    options.socialBinding,
    `SELECT
       id,
       tenant_id,
       saas_id,
       provider,
       external_profile_id,
       author_urn,
       encrypted_access_token,
       encrypted_refresh_token,
       encrypted_id_token,
       scopes,
       expires_at,
       token_type,
       status,
       metadata_json,
       last_validated_at,
       last_error_code,
       last_error_message
     FROM socialflow_oauth_connections`,
    { configPath: options.configPath },
  ) as SocialOAuthRow[];
}

function assertLocalD1Ready(options: { configPath: string; dracoBinding: string; socialBinding: string }) {
  const dracoTables = runWranglerJson(
    options.dracoBinding,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('drako_integration_connections','drako_integration_credentials');",
    { configPath: options.configPath },
  ) as Array<{ name?: string }>;
  for (const table of REQUIRED_DRACO_TABLES) {
    assertTableExists(dracoTables, table);
  }

  const socialTables = runWranglerJson(
    options.socialBinding,
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${asSqlValue(REQUIRED_SOCIAL_TABLE)};`,
    { configPath: options.configPath },
  ) as Array<{ name?: string }>;
  assertTableExists(socialTables, REQUIRED_SOCIAL_TABLE);
}

async function loadFromLocalD1(options: {
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
  encryptionSecret?: string | null;
}): Promise<SocialFlowOAuthConnectionsParityReport> {
  assertLocalD1Ready(options);
  const connections = loadCoreConnections(options);
  const credentials = loadCoreCredentials(options);
  const socialRows = loadSocialRows(options);

  const coreComparable = await buildCoreComparableRows({
    connections,
    credentials,
    optionsSecret: options.encryptionSecret,
  });
  const socialComparable = await buildSocialComparableRows({
    socialRows,
    optionsSecret: options.encryptionSecret,
  });

  return buildParityReport(coreComparable, socialComparable, "d1-local");
}

async function loadFromFixtures(options: {
  fixturesDir: string;
  encryptionSecret?: string | null;
}): Promise<SocialFlowOAuthConnectionsParityReport> {
  const schemaPath = path.resolve(process.cwd(), options.fixturesDir, FIXTURE_SCHEMA_FILE);
  const sourcePath = path.resolve(process.cwd(), options.fixturesDir, FIXTURE_SOURCE_FILE);
  const targetPath = path.resolve(process.cwd(), options.fixturesDir, FIXTURE_TARGET_FILE);

  const [schemaRaw, sourceRaw, targetRaw] = await Promise.all([
    fs.readFile(schemaPath, "utf8"),
    fs.readFile(sourcePath, "utf8"),
    fs.readFile(targetPath, "utf8"),
  ]);

  const schema = JSON.parse(schemaRaw) as FixtureSchema;
  assertFixturesReady(schema);
  const source = JSON.parse(sourceRaw) as FixtureSource;
  const socialRows = JSON.parse(targetRaw) as SocialOAuthRow[];

  const coreComparable = await buildCoreComparableRows({
    connections: source.connections,
    credentials: source.credentials,
    optionsSecret: options.encryptionSecret,
    fixtureSecret: schema.env?.socialflowTokenEncryptionSecret ?? null,
  });
  const socialComparable = await buildSocialComparableRows({
    socialRows,
    optionsSecret: options.encryptionSecret,
    fixtureSecret: schema.env?.socialflowTokenEncryptionSecret ?? null,
  });

  return buildParityReport(coreComparable, socialComparable, "fixtures");
}

function parseArgs(argv: string[]): ParsedArgs {
  const allowDrift = argv.includes("--allow-drift");
  const configArg = argv.find((value) => value.startsWith("--config="));
  const dracoArg = argv.find((value) => value.startsWith("--draco-binding="));
  const socialArg = argv.find((value) => value.startsWith("--social-binding="));
  const fixturesArg = argv.find((value) => value.startsWith("--fixtures-dir="));
  const secretArg = argv.find((value) => value.startsWith("--encryption-secret="));

  return {
    allowDrift,
    configPath: configArg ? configArg.slice("--config=".length) : "wrangler.workers.toml",
    dracoBinding: dracoArg ? dracoArg.slice("--draco-binding=".length) : "DRACO_DB",
    socialBinding: socialArg ? socialArg.slice("--social-binding=".length) : "SOCIAL_DB",
    fixturesDir: fixturesArg ? fixturesArg.slice("--fixtures-dir=".length) : null,
    encryptionSecret: secretArg ? secretArg.slice("--encryption-secret=".length) : null,
  };
}

export async function runCheckSocialflowOAuthConnectionsParity(
  options: RunOptions = {},
): Promise<SocialFlowOAuthConnectionsParityReport> {
  const configPath = options.configPath ?? "wrangler.workers.toml";
  const dracoBinding = options.dracoBinding ?? "DRACO_DB";
  const socialBinding = options.socialBinding ?? "SOCIAL_DB";
  const fixturesDir = options.fixturesDir ?? process.env.FIXTURES_DIR ?? null;
  const encryptionSecret = options.encryptionSecret ?? null;
  const log = options.log ?? console.log;

  const report = fixturesDir
    ? await loadFromFixtures({
      fixturesDir,
      encryptionSecret,
    })
    : await loadFromLocalD1({
      configPath,
      dracoBinding,
      socialBinding,
      encryptionSecret,
    });

  reportToConsole(report, log);
  return report;
}

export function resolveOAuthParityExitCode(
  report: SocialFlowOAuthConnectionsParityReport,
  allowDrift: boolean,
): number {
  if (!hasDrift(report)) {
    return 0;
  }
  return allowDrift ? 0 : 2;
}

export async function runCheckSocialflowOAuthConnectionsParityCli(
  argv: string[],
  io: { log: (line: string) => void; error: (line: string) => void } = {
    log: console.log,
    error: console.error,
  },
): Promise<number> {
  const args = parseArgs(argv);
  try {
    const report = await runCheckSocialflowOAuthConnectionsParity({
      configPath: args.configPath,
      dracoBinding: args.dracoBinding,
      socialBinding: args.socialBinding,
      fixturesDir: args.fixturesDir,
      encryptionSecret: args.encryptionSecret,
      log: io.log,
    });
    const code = resolveOAuthParityExitCode(report, args.allowDrift);
    if (code !== 0) {
      io.error("SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_DRIFT_DETECTED");
    }
    if (hasDrift(report) && args.allowDrift) {
      io.log("SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_ALLOW_DRIFT=true");
    }
    return code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.error(`SOCIALFLOW_OAUTH_CONNECTIONS_PARITY_ERROR ${message}`);
    return 1;
  }
}

async function runCli(): Promise<void> {
  const code = await runCheckSocialflowOAuthConnectionsParityCli(process.argv.slice(2));
  if (code !== 0) {
    process.exit(code);
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  void runCli();
}
