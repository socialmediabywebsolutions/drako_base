import { queryAll, queryOne, run } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";
export type WorkspacePlan = "STARTER" | "PRO" | "ENTERPRISE";
export type WorkspaceOnboardingStep =
  | "create_workspace"
  | "invite_team"
  | "connect_product"
  | "activate_subscription"
  | "complete";

export type WorkspaceTenantRecord = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  createdBy: string | null;
  createdAt: string;
};

export type WorkspaceMembershipRecord = {
  id: string;
  tenantId: string;
  userId: string;
  email: string;
  role: WorkspaceRole;
  tenantName: string;
  tenantSlug: string;
  tenantPlan: string;
  tenantStatus: string;
  createdAt: string;
};

export type WorkspaceUserRecord = {
  id: string;
  email: string;
  name: string | null;
  emailVerified: string | null;
  activeTenantId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceResolvedSession = {
  userId: string;
  email: string;
  name: string | null;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: WorkspaceRole;
  sessionToken: string;
  expires: string;
};

export type WorkspaceConnectedProductRecord = {
  id: string;
  slug: string;
  name: string;
  status: string;
};

export type TenantInviteRecord = {
  id: string;
  tenantId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  tenantName?: string;
  tenantSlug?: string;
};

export type TenantBillingRecord = {
  tenantId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: WorkspacePlan;
  status: string;
  currentPeriodEnd: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantOnboardingRecord = {
  tenantId: string;
  step: WorkspaceOnboardingStep;
  completedSteps: WorkspaceOnboardingStep[];
  createdAt: string;
  updatedAt: string;
};

type AuthUserRow = {
  id: string;
  email: string;
  name: string | null;
  email_verified: string | null;
  active_tenant_id: string | null;
  created_at: string;
  updated_at: string;
  password_hash?: string | null;
  hash?: string | null;
  salt?: string | null;
  iterations?: number | null;
};

type MembershipRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  email: string;
  role: WorkspaceRole;
  created_at: string;
  tenant_name: string;
  tenant_slug: string;
  tenant_plan: string;
  tenant_status: string;
};

type BillingRow = {
  tenant_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: WorkspacePlan;
  status: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
};

type OnboardingRow = {
  tenant_id: string;
  step: WorkspaceOnboardingStep;
  completed_steps: string;
  created_at: string;
  updated_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeName(name: string | null | undefined): string | null {
  const value = name?.trim();
  return value ? value : null;
}

function normalizeSlugPart(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `workspace-${Math.random().toString(16).slice(2, 8)}`;
}

function normalizeRole(role: string | null | undefined): WorkspaceRole {
  const upper = (role ?? "MEMBER").trim().toUpperCase();
  if (upper === "OWNER" || upper === "ADMIN" || upper === "MEMBER") {
    return upper;
  }
  if (upper === "SUPERADMIN" || upper === "OWNER_ADMIN") return "OWNER";
  return upper === "USER" ? "MEMBER" : "ADMIN";
}

export function hasRequiredWorkspaceRole(currentRole: string | null | undefined, requiredRole: WorkspaceRole): boolean {
  const weights: Record<WorkspaceRole, number> = { MEMBER: 1, ADMIN: 2, OWNER: 3 };
  return weights[normalizeRole(currentRole)] >= weights[requiredRole];
}

function mapUser(row: AuthUserRow | null): WorkspaceUserRecord | null {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    emailVerified: row.email_verified ?? null,
    activeTenantId: row.active_tenant_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMembership(row: MembershipRow): WorkspaceMembershipRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    email: row.email,
    role: normalizeRole(row.role),
    tenantName: row.tenant_name,
    tenantSlug: row.tenant_slug,
    tenantPlan: row.tenant_plan,
    tenantStatus: row.tenant_status,
    createdAt: row.created_at,
  };
}

function mapBilling(row: BillingRow | null): TenantBillingRecord | null {
  if (!row) return null;
  return {
    tenantId: row.tenant_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    plan: row.plan,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseCompletedSteps(value: string | null | undefined): WorkspaceOnboardingStep[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as string[];
    return parsed.filter((item): item is WorkspaceOnboardingStep =>
      item === "create_workspace"
      || item === "invite_team"
      || item === "connect_product"
      || item === "activate_subscription"
      || item === "complete",
    );
  } catch {
    return [];
  }
}

function mapOnboarding(row: OnboardingRow | null): TenantOnboardingRecord | null {
  if (!row) return null;
  return {
    tenantId: row.tenant_id,
    step: row.step,
    completedSteps: parseCompletedSteps(row.completed_steps),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function summarizeOnboarding(record: TenantOnboardingRecord | null) {
  const orderedSteps: WorkspaceOnboardingStep[] = [
    "create_workspace",
    "invite_team",
    "connect_product",
    "activate_subscription",
  ];
  const completed = new Set(record?.completedSteps ?? []);
  const completedCount = orderedSteps.filter((step) => completed.has(step)).length;
  const progress = Math.round((completedCount / orderedSteps.length) * 100);
  const nextStep = orderedSteps.find((step) => !completed.has(step)) ?? null;
  return { progress, nextStep, completedCount, totalSteps: orderedSteps.length };
}

export async function getWorkspaceUserByEmail(email: string): Promise<WorkspaceUserRecord | null> {
  const row = await queryOne<AuthUserRow>(
    `SELECT id, email, name, email_verified, active_tenant_id, created_at, updated_at
     FROM auth_users
     WHERE lower(email) = lower(?)
     LIMIT 1`,
    normalizeEmail(email),
  );
  return mapUser(row);
}

export async function getWorkspaceUserById(userId: string): Promise<WorkspaceUserRecord | null> {
  const row = await queryOne<AuthUserRow>(
    `SELECT id, email, name, email_verified, active_tenant_id, created_at, updated_at
     FROM auth_users
     WHERE id = ?
     LIMIT 1`,
    userId,
  );
  return mapUser(row);
}

export async function getWorkspaceUserWithPasswordByEmail(email: string): Promise<(WorkspaceUserRecord & {
  hash: string;
  salt: string;
  iterations: number;
}) | null> {
  const row = await queryOne<AuthUserRow>(
    `SELECT
      u.id, u.email, u.name, u.email_verified, u.active_tenant_id, u.created_at, u.updated_at,
      c.hash, c.salt, c.iterations
     FROM auth_users u
     JOIN auth_credentials c ON c.user_id = u.id
     WHERE lower(u.email) = lower(?) AND c.type = 'email'
     LIMIT 1`,
    normalizeEmail(email),
  );
  if (!row?.hash || !row.salt || !row.iterations) return null;
  const user = mapUser(row);
  if (!user) return null;
  return {
    ...user,
    hash: row.hash,
    salt: row.salt,
    iterations: row.iterations,
  };
}

export async function listUserMemberships(userId: string): Promise<WorkspaceMembershipRecord[]> {
  const rows = await queryAll<MembershipRow>(
    `SELECT
      tu.id,
      tu.tenant_id,
      tu.user_id,
      tu.email,
      tu.role,
      tu.created_at,
      t.name AS tenant_name,
      t.slug AS tenant_slug,
      t.plan AS tenant_plan,
      t.status AS tenant_status
     FROM tenant_users tu
     JOIN tenants t ON t.id = tu.tenant_id
     WHERE tu.user_id = ?
     ORDER BY datetime(tu.created_at) ASC`,
    userId,
  );
  return rows.map(mapMembership);
}

export async function resolveActiveMembershipForUser(userId: string): Promise<WorkspaceMembershipRecord | null> {
  const user = await getWorkspaceUserById(userId);
  const memberships = await listUserMemberships(userId);
  if (memberships.length === 0) return null;
  if (user?.activeTenantId) {
    const active = memberships.find((item) => item.tenantId === user.activeTenantId);
    if (active) return active;
  }
  return memberships[0] ?? null;
}

export async function findMembershipByTenantAndUser(tenantId: string, userId: string): Promise<WorkspaceMembershipRecord | null> {
  const row = await queryOne<MembershipRow>(
    `SELECT
      tu.id,
      tu.tenant_id,
      tu.user_id,
      tu.email,
      tu.role,
      tu.created_at,
      t.name AS tenant_name,
      t.slug AS tenant_slug,
      t.plan AS tenant_plan,
      t.status AS tenant_status
     FROM tenant_users tu
     JOIN tenants t ON t.id = tu.tenant_id
     WHERE tu.tenant_id = ? AND tu.user_id = ?
     LIMIT 1`,
    tenantId,
    userId,
  );
  return row ? mapMembership(row) : null;
}

export async function setUserActiveTenant(userId: string, tenantId: string): Promise<boolean> {
  return run(
    `UPDATE auth_users
     SET active_tenant_id = ?, updated_at = ?
     WHERE id = ?`,
    tenantId,
    nowIso(),
    userId,
  );
}

export async function ensureTenantOnboarding(tenantId: string): Promise<TenantOnboardingRecord> {
  await run(
    `INSERT INTO tenant_onboarding (tenant_id, step, completed_steps, created_at, updated_at)
     VALUES (?, 'create_workspace', '["create_workspace"]', ?, ?)
     ON CONFLICT(tenant_id) DO NOTHING`,
    tenantId,
    nowIso(),
    nowIso(),
  );
  const row = await queryOne<OnboardingRow>(
    `SELECT tenant_id, step, completed_steps, created_at, updated_at
     FROM tenant_onboarding
     WHERE tenant_id = ?
     LIMIT 1`,
    tenantId,
  );
  if (!row) {
    return {
      tenantId,
      step: "create_workspace",
      completedSteps: ["create_workspace"],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }
  return mapOnboarding(row) as TenantOnboardingRecord;
}

export async function updateTenantOnboarding(input: {
  tenantId: string;
  step: WorkspaceOnboardingStep;
  completedSteps: WorkspaceOnboardingStep[];
}): Promise<TenantOnboardingRecord> {
  const completedSteps = Array.from(new Set(input.completedSteps));
  const effectiveStep = completedSteps.length >= 4 ? "complete" : input.step;
  await run(
    `INSERT INTO tenant_onboarding (tenant_id, step, completed_steps, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id) DO UPDATE SET
       step = excluded.step,
       completed_steps = excluded.completed_steps,
       updated_at = excluded.updated_at`,
    input.tenantId,
    effectiveStep,
    JSON.stringify(completedSteps),
    nowIso(),
    nowIso(),
  );
  return (await ensureTenantOnboarding(input.tenantId));
}

export async function completeOnboardingStep(tenantId: string, step: Exclude<WorkspaceOnboardingStep, "complete">): Promise<TenantOnboardingRecord> {
  const current = await ensureTenantOnboarding(tenantId);
  const completed = new Set(current.completedSteps);
  completed.add(step);
  const orderedSteps: WorkspaceOnboardingStep[] = [
    "create_workspace",
    "invite_team",
    "connect_product",
    "activate_subscription",
  ];
  const nextStep = orderedSteps.find((item) => !completed.has(item)) ?? "complete";
  return updateTenantOnboarding({
    tenantId,
    step: nextStep,
    completedSteps: Array.from(completed),
  });
}

export async function getTenantOnboarding(tenantId: string): Promise<TenantOnboardingRecord | null> {
  const row = await queryOne<OnboardingRow>(
    `SELECT tenant_id, step, completed_steps, created_at, updated_at
     FROM tenant_onboarding
     WHERE tenant_id = ?
     LIMIT 1`,
    tenantId,
  );
  return mapOnboarding(row);
}

export async function createWorkspaceTenant(input: {
  name: string;
  slug?: string;
  createdBy: string;
  plan?: WorkspacePlan;
}): Promise<WorkspaceTenantRecord> {
  const tenantId = `tenant_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const slugBase = normalizeSlugPart(input.slug ?? input.name);
  const slug = `${slugBase}-${tenantId.slice(-6)}`;
  const createdAt = nowIso();
  await run(
    `INSERT INTO tenants (id, slug, name, plan, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`,
    tenantId,
    slug,
    input.name.trim(),
    (input.plan ?? "STARTER").toLowerCase(),
    input.createdBy,
    createdAt,
    createdAt,
  );
  await ensureTenantOnboarding(tenantId);
  const row = await queryOne<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    created_by: string | null;
    created_at: string;
  }>(
    `SELECT id, name, slug, plan, status, created_by, created_at
     FROM tenants WHERE id = ? LIMIT 1`,
    tenantId,
  );
  return {
    id: row?.id ?? tenantId,
    name: row?.name ?? input.name.trim(),
    slug: row?.slug ?? slug,
    plan: row?.plan ?? (input.plan ?? "STARTER").toLowerCase(),
    status: row?.status ?? "active",
    createdBy: row?.created_by ?? input.createdBy,
    createdAt: row?.created_at ?? createdAt,
  };
}

export async function ensureTenantMembership(input: {
  tenantId: string;
  userId: string;
  email: string;
  role: WorkspaceRole;
  invitedBy?: string | null;
}): Promise<WorkspaceMembershipRecord> {
  const id = `tu_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  await run(
    `INSERT INTO tenant_users (id, tenant_id, user_id, email, role, invited_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, email) DO UPDATE SET
       user_id = excluded.user_id,
       role = excluded.role,
       invited_by = COALESCE(excluded.invited_by, tenant_users.invited_by),
       updated_at = excluded.updated_at`,
    id,
    input.tenantId,
    input.userId,
    normalizeEmail(input.email),
    input.role,
    input.invitedBy ?? null,
    nowIso(),
    nowIso(),
  );
  return (await findMembershipByTenantAndUser(input.tenantId, input.userId)) as WorkspaceMembershipRecord;
}

export async function createWorkspaceUser(input: {
  email: string;
  password: string;
  name?: string | null;
}): Promise<WorkspaceUserRecord> {
  const email = normalizeEmail(input.email);
  const existing = await getWorkspaceUserByEmail(email);
  if (existing) {
    throw new Error("EMAIL_EXISTS");
  }
  const secure = await hashPassword(input.password);
  const userId = `user_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const credentialId = `cred_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const name = normalizeName(input.name) ?? email.split("@")[0];
  await run(
    `INSERT INTO auth_users (id, email, name, email_verified, active_tenant_id, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, NULL, NULL, ?, ?, ?)`,
    userId,
    email,
    name,
    secure.hash,
    nowIso(),
    nowIso(),
  );
  await run(
    `INSERT INTO auth_credentials (id, user_id, type, hash, salt, iterations, algo, created_at)
     VALUES (?, ?, 'email', ?, ?, ?, 'PBKDF2-SHA256', ?)`,
    credentialId,
    userId,
    secure.hash,
    secure.salt,
    secure.iterations,
    nowIso(),
  );
  return (await getWorkspaceUserById(userId)) as WorkspaceUserRecord;
}

export async function createWorkspaceUserWithTenant(input: {
  email: string;
  password: string;
  name?: string | null;
  tenantName?: string;
}): Promise<{ user: WorkspaceUserRecord; membership: WorkspaceMembershipRecord }> {
  const user = await createWorkspaceUser({
    email: input.email,
    password: input.password,
    name: input.name,
  });
  const name = normalizeName(input.name) ?? user.email.split("@")[0];
  const tenant = await createWorkspaceTenant({
    name: input.tenantName?.trim() || `${name} Workspace`,
    createdBy: user.id,
    plan: "STARTER",
  });
  const membership = await ensureTenantMembership({
    tenantId: tenant.id,
    userId: user.id,
    email: user.email,
    role: "OWNER",
  });
  await setUserActiveTenant(user.id, tenant.id);
  await completeOnboardingStep(tenant.id, "create_workspace");
  return { user, membership };
}

export async function validateWorkspaceCredentials(email: string, password: string): Promise<WorkspaceResolvedSession | null> {
  const user = await getWorkspaceUserWithPasswordByEmail(email);
  if (!user) return null;
  const valid = await verifyPassword(password, user.hash, user.salt, user.iterations);
  if (!valid) return null;
  const membership = await resolveActiveMembershipForUser(user.id);
  if (!membership) return null;
  const session = await createWorkspaceSession(user.id);
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    tenantId: membership.tenantId,
    tenantName: membership.tenantName,
    tenantSlug: membership.tenantSlug,
    role: membership.role,
    sessionToken: session.sessionToken,
    expires: session.expires,
  };
}

export async function listConnectedWorkspaceProducts(tenantId: string): Promise<WorkspaceConnectedProductRecord[]> {
  const rows = await queryAll<{
    id: string;
    slug: string;
    name: string;
    status: string;
  }>(
    `SELECT id, slug, name, status
     FROM saas_instances
     WHERE tenant_id = ?
       AND status IN ('active', 'trial_active', 'provisioning')
     ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC`,
    tenantId,
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
  }));
}

export async function refreshTenantOnboardingState(tenantId: string): Promise<TenantOnboardingRecord> {
  let onboarding = await ensureTenantOnboarding(tenantId);
  const hasConnectedProduct = (await listConnectedWorkspaceProducts(tenantId)).length > 0;
  if (hasConnectedProduct && !onboarding.completedSteps.includes("connect_product")) {
    onboarding = await completeOnboardingStep(tenantId, "connect_product");
  }
  return onboarding;
}

export async function getWorkspaceSessionByToken(sessionToken: string): Promise<WorkspaceResolvedSession | null> {
  const row = await queryOne<{
    session_token: string;
    expires: string;
    user_id: string;
    email: string;
    name: string | null;
    active_tenant_id: string | null;
    tenant_id: string | null;
    tenant_name: string | null;
    tenant_slug: string | null;
    role: string | null;
  }>(
    `SELECT
      s.session_token,
      s.expires,
      u.id AS user_id,
      u.email,
      u.name,
      u.active_tenant_id,
      tu.tenant_id,
      t.name AS tenant_name,
      t.slug AS tenant_slug,
      tu.role
     FROM auth_sessions s
     JOIN auth_users u ON u.id = s.user_id
     LEFT JOIN tenant_users tu
       ON tu.user_id = u.id
      AND tu.tenant_id = COALESCE(u.active_tenant_id, tu.tenant_id)
     LEFT JOIN tenants t ON t.id = tu.tenant_id
     WHERE s.session_token = ?
       AND datetime(s.expires) > datetime('now')
     LIMIT 1`,
    sessionToken,
  );
  if (!row) return null;

  let membership: WorkspaceMembershipRecord | null = null;
  if (row.tenant_id) {
    membership = await findMembershipByTenantAndUser(row.tenant_id, row.user_id);
  }
  if (!membership) {
    membership = await resolveActiveMembershipForUser(row.user_id);
  }
  if (!membership) return null;

  return {
    userId: row.user_id,
    email: row.email,
    name: row.name,
    tenantId: membership.tenantId,
    tenantName: membership.tenantName,
    tenantSlug: membership.tenantSlug,
    role: membership.role,
    sessionToken: row.session_token,
    expires: row.expires,
  };
}

export async function createWorkspaceSession(userId: string, expiresInDays = 30): Promise<{ sessionToken: string; expires: string }> {
  const sessionToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const expires = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  await run(
    `INSERT INTO auth_sessions (session_token, user_id, expires, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    sessionToken,
    userId,
    expires,
    nowIso(),
    nowIso(),
  );
  return { sessionToken, expires };
}

export async function deleteWorkspaceSession(sessionToken: string): Promise<void> {
  await run(`DELETE FROM auth_sessions WHERE session_token = ?`, sessionToken);
}

export async function listTenantMembers(tenantId: string): Promise<Array<WorkspaceMembershipRecord & { userName: string | null }>> {
  const rows = await queryAll<MembershipRow & { user_name: string | null }>(
    `SELECT
      tu.id,
      tu.tenant_id,
      tu.user_id,
      tu.email,
      tu.role,
      tu.created_at,
      t.name AS tenant_name,
      t.slug AS tenant_slug,
      t.plan AS tenant_plan,
      t.status AS tenant_status,
      u.name AS user_name
     FROM tenant_users tu
     JOIN tenants t ON t.id = tu.tenant_id
     LEFT JOIN auth_users u ON u.id = tu.user_id
     WHERE tu.tenant_id = ?
     ORDER BY
       CASE tu.role WHEN 'OWNER' THEN 0 WHEN 'ADMIN' THEN 1 ELSE 2 END,
       datetime(tu.created_at) ASC`,
    tenantId,
  );
  return rows.map((row) => ({ ...mapMembership(row), userName: row.user_name ?? null }));
}

export async function updateTenantMemberRole(input: {
  tenantId: string;
  userId: string;
  role: WorkspaceRole;
}): Promise<boolean> {
  return run(
    `UPDATE tenant_users
     SET role = ?, updated_at = ?
     WHERE tenant_id = ? AND user_id = ?`,
    input.role,
    nowIso(),
    input.tenantId,
    input.userId,
  );
}

export async function createTenantInvite(input: {
  tenantId: string;
  email: string;
  role: WorkspaceRole;
  createdBy: string;
  expiresAt?: string;
}): Promise<TenantInviteRecord> {
  const inviteId = `invite_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = input.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await run(
    `INSERT INTO tenant_invites (id, tenant_id, email, role, token, status, expires_at, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
    inviteId,
    input.tenantId,
    normalizeEmail(input.email),
    input.role,
    token,
    expiresAt,
    input.createdBy,
    nowIso(),
    nowIso(),
  );
  const invite = await getTenantInviteByToken(token);
  return invite as TenantInviteRecord;
}

export async function getTenantInviteByToken(token: string): Promise<TenantInviteRecord | null> {
  const row = await queryOne<{
    id: string;
    tenant_id: string;
    email: string;
    role: WorkspaceRole;
    token: string;
    status: "pending" | "accepted" | "expired" | "revoked";
    expires_at: string;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    tenant_name: string;
    tenant_slug: string;
  }>(
    `SELECT
      i.id,
      i.tenant_id,
      i.email,
      i.role,
      i.token,
      i.status,
      i.expires_at,
      i.created_by,
      i.created_at,
      i.updated_at,
      t.name AS tenant_name,
      t.slug AS tenant_slug
     FROM tenant_invites i
     JOIN tenants t ON t.id = i.tenant_id
     WHERE i.token = ?
     LIMIT 1`,
    token,
  );
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    role: normalizeRole(row.role),
    token: row.token,
    status: row.status,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tenantName: row.tenant_name,
    tenantSlug: row.tenant_slug,
  };
}

export async function listTenantInvites(tenantId: string): Promise<TenantInviteRecord[]> {
  const rows = await queryAll<{
    id: string;
    tenant_id: string;
    email: string;
    role: WorkspaceRole;
    token: string;
    status: "pending" | "accepted" | "expired" | "revoked";
    expires_at: string;
    created_by: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, tenant_id, email, role, token, status, expires_at, created_by, created_at, updated_at
     FROM tenant_invites
     WHERE tenant_id = ?
     ORDER BY datetime(created_at) DESC`,
    tenantId,
  );
  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    role: normalizeRole(row.role),
    token: row.token,
    status: row.status,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function acceptTenantInvite(input: {
  token: string;
  userId: string;
  email: string;
}): Promise<WorkspaceMembershipRecord> {
  const invite = await getTenantInviteByToken(input.token);
  if (!invite) {
    throw new Error("INVITE_NOT_FOUND");
  }
  if (invite.status !== "pending") {
    throw new Error("INVITE_NOT_PENDING");
  }
  if (new Date(invite.expiresAt).getTime() <= Date.now()) {
    await run(
      `UPDATE tenant_invites SET status = 'expired', updated_at = ? WHERE id = ?`,
      nowIso(),
      invite.id,
    );
    throw new Error("INVITE_EXPIRED");
  }
  if (normalizeEmail(invite.email) !== normalizeEmail(input.email)) {
    throw new Error("INVITE_EMAIL_MISMATCH");
  }

  const membership = await ensureTenantMembership({
    tenantId: invite.tenantId,
    userId: input.userId,
    email: invite.email,
    role: invite.role,
    invitedBy: invite.createdBy,
  });
  await setUserActiveTenant(input.userId, invite.tenantId);
  await run(
    `UPDATE tenant_invites
     SET status = 'accepted', updated_at = ?
     WHERE id = ?`,
    nowIso(),
    invite.id,
  );
  await completeOnboardingStep(invite.tenantId, "invite_team");
  return membership;
}

export async function getTenantBilling(tenantId: string): Promise<TenantBillingRecord | null> {
  const row = await queryOne<BillingRow>(
    `SELECT tenant_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, created_at, updated_at
     FROM tenant_billing
     WHERE tenant_id = ?
     LIMIT 1`,
    tenantId,
  );
  return mapBilling(row);
}

export async function upsertTenantBilling(input: {
  tenantId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  plan: WorkspacePlan;
  status: string;
  currentPeriodEnd?: string | null;
}): Promise<TenantBillingRecord> {
  await run(
    `INSERT INTO tenant_billing (
      tenant_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id) DO UPDATE SET
       stripe_customer_id = COALESCE(excluded.stripe_customer_id, tenant_billing.stripe_customer_id),
       stripe_subscription_id = COALESCE(excluded.stripe_subscription_id, tenant_billing.stripe_subscription_id),
       plan = excluded.plan,
       status = excluded.status,
       current_period_end = excluded.current_period_end,
       updated_at = excluded.updated_at`,
    input.tenantId,
    input.stripeCustomerId ?? null,
    input.stripeSubscriptionId ?? null,
    input.plan,
    input.status,
    input.currentPeriodEnd ?? null,
    nowIso(),
    nowIso(),
  );
  if (["active", "trialing"].includes(input.status.toLowerCase())) {
    await completeOnboardingStep(input.tenantId, "activate_subscription");
  }
  return (await getTenantBilling(input.tenantId)) as TenantBillingRecord;
}

export async function ensureTenantBilling(tenantId: string): Promise<TenantBillingRecord> {
  await run(
    `INSERT INTO tenant_billing (tenant_id, plan, status, created_at, updated_at)
     VALUES (?, 'STARTER', 'inactive', ?, ?)
     ON CONFLICT(tenant_id) DO NOTHING`,
    tenantId,
    nowIso(),
    nowIso(),
  );
  return (await getTenantBilling(tenantId)) as TenantBillingRecord;
}

export async function resolveWorkspaceTenant(tenantId: string): Promise<WorkspaceTenantRecord | null> {
  const row = await queryOne<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    created_by: string | null;
    created_at: string;
  }>(
    `SELECT id, name, slug, plan, status, created_by, created_at
     FROM tenants
     WHERE id = ?
     LIMIT 1`,
    tenantId,
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function resolveWorkspaceBySlug(slug: string): Promise<WorkspaceTenantRecord | null> {
  const row = await queryOne<{
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    created_by: string | null;
    created_at: string;
  }>(
    `SELECT id, name, slug, plan, status, created_by, created_at
     FROM tenants
     WHERE slug = ?
     LIMIT 1`,
    normalizeSlugPart(slug),
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function ensureUserHasWorkspace(input: {
  userId: string;
  email: string;
  name?: string | null;
}): Promise<WorkspaceMembershipRecord> {
  const existing = await resolveActiveMembershipForUser(input.userId);
  if (existing) return existing;
  const tenant = await createWorkspaceTenant({
    name: input.name?.trim() || `${input.email.split("@")[0]} Workspace`,
    createdBy: input.userId,
    plan: "STARTER",
  });
  const membership = await ensureTenantMembership({
    tenantId: tenant.id,
    userId: input.userId,
    email: input.email,
    role: "OWNER",
  });
  await setUserActiveTenant(input.userId, tenant.id);
  return membership;
}

export async function getDefaultWorkspaceTenantId(): Promise<string> {
  const demo = await resolveWorkspaceTenant(DEMO_TENANT_ID);
  return demo?.id ?? DEMO_TENANT_ID;
}
