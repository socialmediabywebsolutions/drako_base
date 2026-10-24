export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { env } from "@/lib/cf";


type Alert = {
  id: string;
  severity: string;
  source: string;
  message: string;
  saas_id?: string | null;
  department_id?: string | null;
  devarchitect_project_id?: string | null;
  metadata?: string | null;
  status: string;
  resolved_at?: string | null;
  created_at: string;
};

const inMemoryAlerts = new Map<string, Alert[]>();

function createDefaultAlerts(tenantId: string): Alert[] {
  const now = Date.now();
  return [
    {
      id: `alert_${tenantId}_dir_focus`,
      severity: "high",
      source: "core_dir:focus",
      message: "Strategic focus deviation detected in quarterly OKR.",
      department_id: "core_dir",
      devarchitect_project_id: null,
      metadata: null,
      status: "open",
      resolved_at: null,
      created_at: new Date(now - 1000 * 60 * 5).toISOString(),
    },
    {
      id: `alert_${tenantId}_support_sla`,
      severity: "critical",
      source: "core_support:sla",
      message: "Support ticket backlog exceeded SLA thresholds.",
      department_id: "core_support",
      devarchitect_project_id: null,
      metadata: null,
      status: "open",
      resolved_at: null,
      created_at: new Date(now - 1000 * 60 * 12).toISOString(),
    },
    {
      id: `alert_${tenantId}_acc_cashflow`,
      severity: "medium",
      source: "core_acc:cashflow",
      message: "Cashflow variance detected in the last 24 hours.",
      department_id: "core_acc",
      devarchitect_project_id: null,
      metadata: null,
      status: "open",
      resolved_at: null,
      created_at: new Date(now - 1000 * 60 * 30).toISOString(),
    },
  ];
}

function getInMemoryAlerts(tenantId: string): Alert[] {
  const existing = inMemoryAlerts.get(tenantId);
  if (existing) {
    return existing;
  }
  const seeded = createDefaultAlerts(tenantId);
  inMemoryAlerts.set(tenantId, seeded);
  return seeded;
}

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const url = new URL(req.url);
    const saasId = url.searchParams.get("saas_id");
    const severityFilter = url.searchParams.get("severity") ?? undefined;
    const devProjectId = url.searchParams.get("devProjectId") ?? undefined;
    const statusFilter = url.searchParams.get("status") ?? undefined;
    const bindings = env();

    if (!bindings || !bindings.DRACO_DB) {
      const alerts = getInMemoryAlerts(tenantId);
      const filtered = alerts.filter((alert) => {
        if (saasId && alert.saas_id !== saasId) return false;
        if (severityFilter && alert.severity !== severityFilter) return false;
        if (devProjectId && alert.devarchitect_project_id !== devProjectId) return false;
        if (statusFilter && alert.status !== statusFilter) return false;
        return true;
      });
      return NextResponse.json({ items: filtered });
    }

    const base =
      "SELECT id, severity, source, message, created_at, saas_id, devarchitect_project_id, metadata, status, resolved_at FROM alerts WHERE tenant_id = ?";
    const clauses: string[] = [];
    const params: (string)[] = [];
    if (saasId) {
      clauses.push("saas_id = ?");
      params.push(saasId);
    }
    if (severityFilter) {
      clauses.push("severity = ?");
      params.push(severityFilter);
    }
    if (devProjectId) {
      clauses.push("devarchitect_project_id = ?");
      params.push(devProjectId);
    }
    if (statusFilter) {
      clauses.push("status = ?");
      params.push(statusFilter);
    }
    const where = clauses.length > 0 ? ` AND ${clauses.join(" AND ")}` : "";
    const order = " ORDER BY datetime(created_at) DESC LIMIT 200";
    const items = await queryAll<Alert>(`${base}${where}${order}`, tenantId, ...params);
    return NextResponse.json({ items });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("ALERTS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as {
      severity?: string;
      source?: string;
      message?: string;
      saas_id?: string | null;
      devarchitect_project_id?: string | null;
      status?: string;
    } | null;
    if (!body || !body.severity || !body.source || !body.message) {
      return NextResponse.json({ error: "severity, source, message required" }, { status: 400 });
    }
    const id = globalThis.crypto?.randomUUID?.() ?? `alert_${Date.now()}`;
    const bindings = env();

    if (!bindings || !bindings.DRACO_DB) {
      const alert: Alert = {
        id,
        severity: body.severity,
        source: body.source,
        message: body.message,
        saas_id: body.saas_id ?? null,
        department_id: null,
        created_at: new Date().toISOString(),
        status: body.status ?? "open",
        devarchitect_project_id: body.devarchitect_project_id ?? null,
        resolved_at: null,
        metadata: null,
      };
      const existing = getInMemoryAlerts(tenantId);
      inMemoryAlerts.set(tenantId, [alert, ...existing]);
      return NextResponse.json({ ok: true, id });
    }

    const ok = await run(
      "INSERT INTO alerts (id, tenant_id, severity, source, message, saas_id, status, devarchitect_project_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      tenantId,
      body.severity,
      body.source,
      body.message,
      body.saas_id ?? null,
      body.status ?? "open",
      body.devarchitect_project_id ?? null,
    );
    if (!ok) return NextResponse.json({ error: "failed to create alert" }, { status: 500 });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("ALERTS_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}
