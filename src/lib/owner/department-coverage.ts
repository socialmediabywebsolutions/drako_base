import type { DepartmentId, AgentPackTier } from "@/lib/agents/agent-templates";
import type { OwnerSaasAccountingRow } from "@/lib/owner/accounting";
import { queryAll } from "@/lib/db";

export type DepartmentCoverageStatus = "WELL_COVERED" | "PARTIAL" | "CRITICAL_GAP";

export type DepartmentCoverageGap = {
  departmentId: DepartmentId;
  severity: "SOFT" | "HARD";
  reason: string;
};

export type SaasDepartmentCoverage = {
  saasId: string;
  saasName: string;
  verticalId: OwnerSaasAccountingRow["vertical"] | null;
  departmentsEnabled: DepartmentId[];
  packsByDepartment: Record<DepartmentId, AgentPackTier>;
  status: DepartmentCoverageStatus;
  gaps: DepartmentCoverageGap[];
};

const PACK_ORDER: AgentPackTier[] = ["BASIC", "STANDARD", "FULL"];

function resolveHigherTier(current: AgentPackTier | null, next: AgentPackTier): AgentPackTier {
  if (!current) return next;
  return PACK_ORDER.indexOf(next) > PACK_ORDER.indexOf(current) ? next : current;
}

function normalizePackTier(value: unknown): AgentPackTier | null {
  if (value === "BASIC" || value === "STANDARD" || value === "FULL") return value;
  return null;
}

function normalizeDepartmentId(value: unknown): DepartmentId | null {
  if (
    value === "MARKETING" ||
    value === "ACCOUNTING" ||
    value === "SUPPORT" ||
    value === "EMAIL_INTAKE" ||
    value === "OPS" ||
    value === "TAX"
  ) {
    return value;
  }
  return null;
}

export async function getSaasDepartmentCoverage(params: {
  tenantId: string;
  rows: OwnerSaasAccountingRow[];
}): Promise<SaasDepartmentCoverage[]> {
  if (!params.rows.length) return [];
  const ids = params.rows.map((row) => row.saasId);
  const placeholders = ids.map(() => "?").join(",");
  const agentRows = await queryAll<{ saas_id: string; config: string }>(
    `SELECT saas_id, config FROM saas_agents WHERE tenant_id = ? AND saas_id IN (${placeholders})`,
    params.tenantId,
    ...ids,
  );

  const coverageBySaas = new Map<string, { departments: Set<DepartmentId>; packs: Partial<Record<DepartmentId, AgentPackTier>> }>();

  agentRows.forEach((row) => {
    let config: { departmentId?: string; packTier?: string } | null = null;
    try {
      config = JSON.parse(row.config) as { departmentId?: string; packTier?: string } | null;
    } catch {
      config = null;
    }
    const departmentId = normalizeDepartmentId(config?.departmentId);
    if (!departmentId) return;
    const packTier = normalizePackTier(config?.packTier) ?? "BASIC";
    const entry = coverageBySaas.get(row.saas_id) ?? {
      departments: new Set<DepartmentId>(),
      packs: {},
    };
    entry.departments.add(departmentId);
    entry.packs[departmentId] = resolveHigherTier(entry.packs[departmentId] ?? null, packTier);
    coverageBySaas.set(row.saas_id, entry);
  });

  return params.rows.map((row) => {
    const entry = coverageBySaas.get(row.saasId);
    const departmentsEnabled = entry ? Array.from(entry.departments) : [];
    const packsByDepartment = {
      MARKETING: entry?.packs.MARKETING ?? "BASIC",
      ACCOUNTING: entry?.packs.ACCOUNTING ?? "BASIC",
      SUPPORT: entry?.packs.SUPPORT ?? "BASIC",
      EMAIL_INTAKE: entry?.packs.EMAIL_INTAKE ?? "BASIC",
      OPS: entry?.packs.OPS ?? "BASIC",
      TAX: entry?.packs.TAX ?? "BASIC",
    };

    const gaps: DepartmentCoverageGap[] = [];
    if (!departmentsEnabled.includes("ACCOUNTING")) {
      gaps.push({ departmentId: "ACCOUNTING", severity: "HARD", reason: "No Accounting department configured." });
    }
    if (!departmentsEnabled.includes("SUPPORT")) {
      gaps.push({ departmentId: "SUPPORT", severity: "HARD", reason: "No Support department configured." });
    }
    if (departmentsEnabled.includes("MARKETING") && packsByDepartment.MARKETING === "BASIC") {
      gaps.push({ departmentId: "MARKETING", severity: "SOFT", reason: "Marketing pack is BASIC." });
    }

    const status: DepartmentCoverageStatus = gaps.some((gap) => gap.severity === "HARD")
      ? "CRITICAL_GAP"
      : gaps.length > 0
        ? "PARTIAL"
        : "WELL_COVERED";

    return {
      saasId: row.saasId,
      saasName: row.saasName,
      verticalId: row.vertical ?? null,
      departmentsEnabled,
      packsByDepartment,
      status,
      gaps,
    };
  });
}
