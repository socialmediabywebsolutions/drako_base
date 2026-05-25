import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type BackfillMode = "d1-local" | "fixtures";

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
  created_at: string;
  updated_at: string;
};

type PreparedOAuthRow = Omit<SocialOAuthRow, "created_at" | "updated_at">;

type Operation = {
  key: string;
  type: "insert" | "update" | "unchanged";
  entry: PreparedOAuthRow;
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
  dryRun?: boolean;
  configPath?: string;
  dracoBinding?: string;
  socialBinding?: string;
  fixturesDir?: string | null;
  encryptionSecret?: string | null;
  log?: (line: string) => void;
};

export type SocialFlowOAuthConnectionsBackfillReport = {
  mode: BackfillMode;
  dryRun: boolean;
  scanned: number;
  selected: number;
  inserts: number;
  updates: number;
  unchanged: number;
};

type ParsedArgs = {
  dryRun: boolean;
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
  fixturesDir: string | null;
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
    throw new Error("SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_WEBCRYPTO_UNAVAILABLE");
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

async function encryptTokenWithSecret(secret: string, plaintext: string): Promise<string> {
  const key = await deriveEncryptionKey(secret);
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  return `${TOKEN_ENCRYPTION_PREFIX}:${TOKEN_ENCRYPTION_VERSION}:${TOKEN_ENCRYPTION_ALGORITHM}:${base64Encode(iv.buffer)}:${base64Encode(ciphertext)}`;
}

async function decryptTokenWithSecret(secret: string, encrypted: string): Promise<string> {
  const parts = encrypted.split(":");
  if (parts.length !== 5) {
    throw new Error("SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_TOKEN_FORMAT_INVALID");
  }
  const [prefix, version, algorithm, ivBase64, ciphertextBase64] = parts;
  if (prefix !== TOKEN_ENCRYPTION_PREFIX || version !== TOKEN_ENCRYPTION_VERSION || algorithm !== TOKEN_ENCRYPTION_ALGORITHM) {
    throw new Error("SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_TOKEN_FORMAT_UNSUPPORTED");
  }
  const key = await deriveEncryptionKey(secret);
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64Decode(ivBase64) },
    key,
    base64Decode(ciphertextBase64),
  );
  return new TextDecoder().decode(plaintext);
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
    throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_WRANGLER_JSON_FAILED:${stderr.trim()}`);
  }
}

function runWranglerCommand(
  binding: string,
  sql: string,
  options: { configPath: string },
): void {
  try {
    execFileSync(
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
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    const commandError = error as { stderr?: string | Buffer; message?: string };
    const stderr = typeof commandError.stderr === "string"
      ? commandError.stderr
      : commandError.stderr instanceof Buffer
        ? commandError.stderr.toString("utf8")
        : commandError.message ?? String(error);
    throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_WRANGLER_COMMAND_FAILED:${stderr.trim()}`);
  }
}

function assertTableExists(rows: Array<{ name?: string }>, tableName: string): void {
  if (!rows.some((row) => row.name === tableName)) {
    throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_TABLE_MISSING:${tableName}`);
  }
}

function assertFixturesReady(schema: FixtureSchema): void {
  if (!schema.bindings.draco) {
    throw new Error("SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_BINDING_MISSING:DRACO_DB");
  }
  if (!schema.bindings.social) {
    throw new Error("SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_BINDING_MISSING:SOCIAL_DB");
  }

  for (const table of REQUIRED_DRACO_TABLES) {
    if (!schema.draco.tables.includes(table)) {
      throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_TABLE_MISSING:${table}`);
    }
  }
  if (!schema.social.tables.includes(REQUIRED_SOCIAL_TABLE)) {
    throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_TABLE_MISSING:${REQUIRED_SOCIAL_TABLE}`);
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

function buildKey(tenantId: string, saasId: string, provider: string): string {
  return `${tenantId}::${saasId}::${provider.toUpperCase()}`;
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

function resolveBackfillEncryptionSecret(options: {
  optionsSecret?: string | null;
  fixtureSecret?: string | null;
}): string {
  const candidate = normalizeText(
    options.optionsSecret
    ?? options.fixtureSecret
    ?? process.env.SOCIALFLOW_TOKEN_ENCRYPTION_SECRET,
  );
  if (!candidate) {
    throw new Error("SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_ENCRYPTION_SECRET_MISSING");
  }
  if (candidate.length < 32) {
    throw new Error("SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_ENCRYPTION_SECRET_TOO_SHORT");
  }
  return candidate;
}

async function normalizeEncryptedTokenValue(input: {
  sourceValue: string | null;
  existingValue: string | null;
  field: "access" | "refresh" | "id";
  optionsSecret?: string | null;
  fixtureSecret?: string | null;
}): Promise<string | null> {
  const source = normalizeNullableString(input.sourceValue);
  if (!source) return null;
  if (isEncryptedTokenValue(source)) return source;

  const existing = normalizeNullableString(input.existingValue);
  if (existing && isEncryptedTokenValue(existing)) {
    const secret = resolveBackfillEncryptionSecret({
      optionsSecret: input.optionsSecret,
      fixtureSecret: input.fixtureSecret,
    });
    try {
      const decrypted = await decryptTokenWithSecret(secret, existing);
      if (decrypted === source) {
        return existing;
      }
    } catch {
      // Re-encrypt below when decryption fails.
    }
  }

  const secret = resolveBackfillEncryptionSecret({
    optionsSecret: input.optionsSecret,
    fixtureSecret: input.fixtureSecret,
  });
  const encrypted = await encryptTokenWithSecret(secret, source);
  return encrypted;
}

function toComparableEntry(row: PreparedOAuthRow | SocialOAuthRow): PreparedOAuthRow {
  return {
    id: normalizeText(row.id),
    tenant_id: normalizeText(row.tenant_id),
    saas_id: normalizeText(row.saas_id),
    provider: normalizeProvider(row.provider),
    external_profile_id: normalizeText(row.external_profile_id),
    author_urn: normalizeNullableString(row.author_urn),
    encrypted_access_token: normalizeText(row.encrypted_access_token),
    encrypted_refresh_token: normalizeNullableString(row.encrypted_refresh_token),
    encrypted_id_token: normalizeNullableString(row.encrypted_id_token),
    scopes: normalizeNullableString(row.scopes),
    expires_at: normalizeNullableString(row.expires_at),
    token_type: normalizeNullableString(row.token_type),
    status: normalizeStatus(row.status),
    metadata_json: normalizeText(row.metadata_json),
    last_validated_at: normalizeNullableString(row.last_validated_at),
    last_error_code: normalizeNullableString(row.last_error_code),
    last_error_message: normalizeNullableString(row.last_error_message),
  };
}

function equivalentEntry(left: PreparedOAuthRow, right: SocialOAuthRow): boolean {
  const a = toComparableEntry(left);
  const b = toComparableEntry(right);
  return (
    a.id === b.id
    && a.tenant_id === b.tenant_id
    && a.saas_id === b.saas_id
    && a.provider === b.provider
    && a.external_profile_id === b.external_profile_id
    && a.author_urn === b.author_urn
    && a.encrypted_access_token === b.encrypted_access_token
    && a.encrypted_refresh_token === b.encrypted_refresh_token
    && a.encrypted_id_token === b.encrypted_id_token
    && a.scopes === b.scopes
    && a.expires_at === b.expires_at
    && a.token_type === b.token_type
    && a.status === b.status
    && a.metadata_json === b.metadata_json
    && a.last_validated_at === b.last_validated_at
    && a.last_error_code === b.last_error_code
    && a.last_error_message === b.last_error_message
  );
}

async function buildPreparedRows(input: {
  connections: CoreConnectionRow[];
  credentials: CoreCredentialRow[];
  existingRows: SocialOAuthRow[];
  optionsSecret?: string | null;
  fixtureSecret?: string | null;
}): Promise<PreparedOAuthRow[]> {
  const credentialsByConnection = new Map<string, CoreCredentialRow>();
  for (const credential of input.credentials) {
    credentialsByConnection.set(normalizeText(credential.connection_id), credential);
  }

  const existingByKey = new Map<string, SocialOAuthRow>();
  for (const row of input.existingRows) {
    existingByKey.set(
      buildKey(normalizeText(row.tenant_id), normalizeText(row.saas_id), normalizeProvider(row.provider)),
      row,
    );
  }

  const dedupedByKey = new Map<string, CoreConnectionRow>();
  for (const row of input.connections) {
    if (normalizeText(row.integration_key).toLowerCase() !== LINKEDIN_INTEGRATION_KEY) continue;
    const tenantId = normalizeText(row.tenant_id);
    const saasId = normalizeText(row.saas_id);
    if (!tenantId || !saasId) continue;
    const key = buildKey(tenantId, saasId, LINKEDIN_PROVIDER);
    if (!dedupedByKey.has(key)) {
      dedupedByKey.set(key, row);
    }
  }

  const preparedRows: PreparedOAuthRow[] = [];
  for (const [key, connection] of dedupedByKey.entries()) {
    const tenantId = normalizeText(connection.tenant_id);
    const saasId = normalizeText(connection.saas_id);
    const credentialRow = credentialsByConnection.get(normalizeText(connection.connection_id));
    if (!credentialRow) {
      throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_CREDENTIALS_MISSING:${key}`);
    }

    const credentials = parseJsonObject(credentialRow.payload_json);
    const metadata = parseJsonObject(connection.metadata_json);
    const existing = existingByKey.get(key) ?? null;

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
      throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_PROFILE_ID_MISSING:${key}`);
    }

    const accessTokenSource =
      normalizeNullableString(credentials.accessToken)
      ?? normalizeNullableString(credentials.access_token);
    if (!accessTokenSource) {
      throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_ACCESS_TOKEN_MISSING:${key}`);
    }

    const refreshTokenSource =
      normalizeNullableString(credentials.refreshToken)
      ?? normalizeNullableString(credentials.refresh_token);
    const idTokenSource =
      normalizeNullableString(credentials.idToken)
      ?? normalizeNullableString(credentials.id_token);

    const encryptedAccessToken = await normalizeEncryptedTokenValue({
      sourceValue: accessTokenSource,
      existingValue: existing?.encrypted_access_token ?? null,
      field: "access",
      optionsSecret: input.optionsSecret,
      fixtureSecret: input.fixtureSecret,
    });
    if (!encryptedAccessToken) {
      throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_ACCESS_TOKEN_ENCRYPTION_FAILED:${key}`);
    }

    const encryptedRefreshToken = await normalizeEncryptedTokenValue({
      sourceValue: refreshTokenSource,
      existingValue: existing?.encrypted_refresh_token ?? null,
      field: "refresh",
      optionsSecret: input.optionsSecret,
      fixtureSecret: input.fixtureSecret,
    });
    const encryptedIdToken = await normalizeEncryptedTokenValue({
      sourceValue: idTokenSource,
      existingValue: existing?.encrypted_id_token ?? null,
      field: "id",
      optionsSecret: input.optionsSecret,
      fixtureSecret: input.fixtureSecret,
    });

    const canonicalAuthorUrn = authorUrn ?? `urn:li:person:${profileId}`;
    const metadataJson = JSON.stringify({
      mode: "live",
      provider: "LINKEDIN",
      profileId,
      authorUrn: canonicalAuthorUrn,
      displayName: normalizeNullableString(metadata.displayName),
      email: normalizeNullableString(metadata.email),
      picture: metadata.picture ?? null,
      locale: metadata.locale ?? null,
      source: "core_backfill",
    });

    preparedRows.push({
      id: normalizeText(existing?.id) || normalizeText(connection.connection_id) || crypto.randomUUID(),
      tenant_id: tenantId,
      saas_id: saasId,
      provider: LINKEDIN_PROVIDER,
      external_profile_id: profileId,
      author_urn: canonicalAuthorUrn,
      encrypted_access_token: encryptedAccessToken,
      encrypted_refresh_token: encryptedRefreshToken,
      encrypted_id_token: encryptedIdToken,
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

  return preparedRows.sort((a, b) => buildKey(a.tenant_id, a.saas_id, a.provider).localeCompare(buildKey(b.tenant_id, b.saas_id, b.provider)));
}

function planOperations(selectedRows: PreparedOAuthRow[], existingRows: SocialOAuthRow[]): Operation[] {
  const existingByKey = new Map<string, SocialOAuthRow>();
  for (const row of existingRows) {
    existingByKey.set(
      buildKey(normalizeText(row.tenant_id), normalizeText(row.saas_id), normalizeProvider(row.provider)),
      row,
    );
  }

  return selectedRows.map((entry) => {
    const key = buildKey(entry.tenant_id, entry.saas_id, normalizeProvider(entry.provider));
    const existing = existingByKey.get(key);
    if (!existing) {
      return { key, type: "insert", entry };
    }
    if (!equivalentEntry(entry, existing)) {
      return { key, type: "update", entry };
    }
    return { key, type: "unchanged", entry };
  });
}

async function loadFixturesState(fixturesDir: string): Promise<{
  schema: FixtureSchema;
  source: FixtureSource;
  targetRows: SocialOAuthRow[];
  targetPath: string;
}> {
  const schemaPath = path.resolve(process.cwd(), fixturesDir, FIXTURE_SCHEMA_FILE);
  const sourcePath = path.resolve(process.cwd(), fixturesDir, FIXTURE_SOURCE_FILE);
  const targetPath = path.resolve(process.cwd(), fixturesDir, FIXTURE_TARGET_FILE);

  const [schemaRaw, sourceRaw, targetRaw] = await Promise.all([
    fs.readFile(schemaPath, "utf8"),
    fs.readFile(sourcePath, "utf8"),
    fs.readFile(targetPath, "utf8"),
  ]);

  return {
    schema: JSON.parse(schemaRaw) as FixtureSchema,
    source: JSON.parse(sourceRaw) as FixtureSource,
    targetRows: JSON.parse(targetRaw) as SocialOAuthRow[],
    targetPath,
  };
}

async function runFixturesBackfill(
  fixturesDir: string,
  dryRun: boolean,
  options: { encryptionSecret?: string | null },
): Promise<SocialFlowOAuthConnectionsBackfillReport> {
  const state = await loadFixturesState(fixturesDir);
  assertFixturesReady(state.schema);

  const selectedRows = await buildPreparedRows({
    connections: state.source.connections,
    credentials: state.source.credentials,
    existingRows: state.targetRows,
    optionsSecret: options.encryptionSecret,
    fixtureSecret: state.schema.env?.socialflowTokenEncryptionSecret ?? null,
  });
  const operations = planOperations(selectedRows, state.targetRows);

  if (!dryRun) {
    const now = new Date().toISOString();
    const nextRows = new Map<string, SocialOAuthRow>();
    for (const row of state.targetRows) {
      nextRows.set(buildKey(row.tenant_id, row.saas_id, row.provider), row);
    }

    for (const operation of operations) {
      if (operation.type === "unchanged") continue;
      const existing = nextRows.get(operation.key);
      if (existing) {
        nextRows.set(operation.key, {
          ...existing,
          ...operation.entry,
          updated_at: now,
        });
      } else {
        nextRows.set(operation.key, {
          ...operation.entry,
          created_at: now,
          updated_at: now,
        });
      }
    }

    const rows = [...nextRows.values()].sort((a, b) =>
      buildKey(a.tenant_id, a.saas_id, a.provider).localeCompare(buildKey(b.tenant_id, b.saas_id, b.provider)),
    );
    await fs.writeFile(state.targetPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  }

  return {
    mode: "fixtures",
    dryRun,
    scanned: state.source.connections.length,
    selected: selectedRows.length,
    inserts: operations.filter((entry) => entry.type === "insert").length,
    updates: operations.filter((entry) => entry.type === "update").length,
    unchanged: operations.filter((entry) => entry.type === "unchanged").length,
  };
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
       last_error_message,
       created_at,
       updated_at
     FROM socialflow_oauth_connections`,
    { configPath: options.configPath },
  ) as SocialOAuthRow[];
}

function applyOperationToLocalD1(
  operation: Operation,
  options: { configPath: string; socialBinding: string },
): void {
  const entry = operation.entry;
  const sql = `
    INSERT INTO socialflow_oauth_connections (
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
      last_error_message,
      created_at,
      updated_at
    ) VALUES (
      ${asSqlValue(entry.id)},
      ${asSqlValue(entry.tenant_id)},
      ${asSqlValue(entry.saas_id)},
      ${asSqlValue(entry.provider)},
      ${asSqlValue(entry.external_profile_id)},
      ${asSqlValue(entry.author_urn)},
      ${asSqlValue(entry.encrypted_access_token)},
      ${asSqlValue(entry.encrypted_refresh_token)},
      ${asSqlValue(entry.encrypted_id_token)},
      ${asSqlValue(entry.scopes)},
      ${asSqlValue(entry.expires_at)},
      ${asSqlValue(entry.token_type)},
      ${asSqlValue(entry.status)},
      ${asSqlValue(entry.metadata_json)},
      ${asSqlValue(entry.last_validated_at)},
      ${asSqlValue(entry.last_error_code)},
      ${asSqlValue(entry.last_error_message)},
      datetime('now'),
      datetime('now')
    )
    ON CONFLICT(tenant_id, saas_id, provider) DO UPDATE SET
      external_profile_id = excluded.external_profile_id,
      author_urn = excluded.author_urn,
      encrypted_access_token = excluded.encrypted_access_token,
      encrypted_refresh_token = excluded.encrypted_refresh_token,
      encrypted_id_token = excluded.encrypted_id_token,
      scopes = excluded.scopes,
      expires_at = excluded.expires_at,
      token_type = excluded.token_type,
      status = excluded.status,
      metadata_json = excluded.metadata_json,
      last_validated_at = excluded.last_validated_at,
      last_error_code = excluded.last_error_code,
      last_error_message = excluded.last_error_message,
      updated_at = excluded.updated_at;
  `;
  runWranglerCommand(options.socialBinding, sql, { configPath: options.configPath });
}

async function runLocalD1Backfill(
  dryRun: boolean,
  options: { configPath: string; dracoBinding: string; socialBinding: string; encryptionSecret?: string | null },
): Promise<SocialFlowOAuthConnectionsBackfillReport> {
  assertLocalD1Ready(options);

  const connections = loadCoreConnections(options);
  const credentials = loadCoreCredentials(options);
  const existingRows = loadSocialRows(options);

  const selectedRows = await buildPreparedRows({
    connections,
    credentials,
    existingRows,
    optionsSecret: options.encryptionSecret,
  });
  const operations = planOperations(selectedRows, existingRows);

  if (!dryRun) {
    for (const operation of operations) {
      if (operation.type === "unchanged") continue;
      applyOperationToLocalD1(operation, {
        configPath: options.configPath,
        socialBinding: options.socialBinding,
      });
    }
  }

  return {
    mode: "d1-local",
    dryRun,
    scanned: connections.length,
    selected: selectedRows.length,
    inserts: operations.filter((entry) => entry.type === "insert").length,
    updates: operations.filter((entry) => entry.type === "update").length,
    unchanged: operations.filter((entry) => entry.type === "unchanged").length,
  };
}

function parseArgs(argv: string[]): ParsedArgs {
  const dryRun = argv.includes("--dry-run");
  const configArg = argv.find((value) => value.startsWith("--config="));
  const dracoArg = argv.find((value) => value.startsWith("--draco-binding="));
  const socialArg = argv.find((value) => value.startsWith("--social-binding="));
  const fixturesArg = argv.find((value) => value.startsWith("--fixtures-dir="));

  return {
    dryRun,
    configPath: configArg ? configArg.slice("--config=".length) : "wrangler.workers.toml",
    dracoBinding: dracoArg ? dracoArg.slice("--draco-binding=".length) : "DRACO_DB",
    socialBinding: socialArg ? socialArg.slice("--social-binding=".length) : "SOCIAL_DB",
    fixturesDir: fixturesArg ? fixturesArg.slice("--fixtures-dir=".length) : null,
  };
}

export async function runBackfillSocialflowOAuthConnections(
  options: RunOptions = {},
): Promise<SocialFlowOAuthConnectionsBackfillReport> {
  const dryRun = options.dryRun ?? false;
  const configPath = options.configPath ?? "wrangler.workers.toml";
  const dracoBinding = options.dracoBinding ?? "DRACO_DB";
  const socialBinding = options.socialBinding ?? "SOCIAL_DB";
  const fixturesDir = options.fixturesDir ?? process.env.FIXTURES_DIR ?? null;
  const log = options.log ?? console.log;

  const report = fixturesDir
    ? await runFixturesBackfill(fixturesDir, dryRun, {
      encryptionSecret: options.encryptionSecret ?? null,
    })
    : await runLocalD1Backfill(dryRun, {
      configPath,
      dracoBinding,
      socialBinding,
      encryptionSecret: options.encryptionSecret ?? null,
    });

  log(`SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL mode=${report.mode} dryRun=${report.dryRun}`);
  log(
    `scanned=${report.scanned} selected=${report.selected} inserts=${report.inserts} updates=${report.updates} unchanged=${report.unchanged}`,
  );
  return report;
}

async function runCli(): Promise<void> {
  try {
    const parsed = parseArgs(process.argv.slice(2));
    const report = await runBackfillSocialflowOAuthConnections({
      dryRun: parsed.dryRun,
      configPath: parsed.configPath,
      dracoBinding: parsed.dracoBinding,
      socialBinding: parsed.socialBinding,
      fixturesDir: parsed.fixturesDir,
    });
    console.log(`SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_REPORT ${JSON.stringify(report)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_ERROR ${message}`);
    process.exit(1);
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  void runCli();
}
