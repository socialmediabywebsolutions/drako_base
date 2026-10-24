export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { queryAll, queryOne } from "@/lib/db";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { respondDatabaseError } from "@/lib/http/errors";
import { CRM_PLANS, crmPlanPrice } from "@/lib/drako/crm-plans";

// /api/operator/crm — CRM del operator en /operator/socialflow (DRACO_DB).
// GET: métricas (clientes activos, MRR estimado, leads 7 días, churn del mes) + los 10
// clientes más recientes. "＋ Crear venta" no pasa por aquí: hace POST a /api/clients
// con plan y notas.
// Vista global del holding: el operator ve los clientes de todos los tenants.

const DAY_MS = 86_400_000;

type ClientRow = {
  id: string;
  name: string;
  email: string | null;
  created_at: string | null;
  plan: string | null;
  link_status: string | null;
  sub_status: string | null;
  last_activity: string | null;
};

// Plan y estado: la última venta del CRM manda; si no hay, el vínculo client_saas o la
// suscripción de Stripe. last_activity = el movimiento más reciente conocido del cliente
// (alta, venta, vínculo o suscripción) — no hay tabla de actividad por cliente.
const CLIENTS_SQL = `
  SELECT c.id, c.name, c.email, c.created_at,
    COALESCE(
      (SELECT s.plan FROM drako_crm_sales s WHERE s.client_id = c.id ORDER BY s.created_at DESC LIMIT 1),
      (SELECT cs.plan FROM client_saas cs WHERE cs.client_id = c.id ORDER BY cs.created_at DESC LIMIT 1),
      (SELECT sub.plan_code FROM client_saas_subscriptions sub WHERE sub.client_id = c.id ORDER BY sub.updated_at DESC LIMIT 1)
    ) AS plan,
    (SELECT cs.status FROM client_saas cs WHERE cs.client_id = c.id ORDER BY cs.created_at DESC LIMIT 1) AS link_status,
    (SELECT sub.status FROM client_saas_subscriptions sub WHERE sub.client_id = c.id ORDER BY sub.updated_at DESC LIMIT 1) AS sub_status,
    MAX(
      COALESCE(c.created_at, ''),
      COALESCE((SELECT MAX(s.created_at) FROM drako_crm_sales s WHERE s.client_id = c.id), ''),
      COALESCE((SELECT MAX(cs.created_at) FROM client_saas cs WHERE cs.client_id = c.id), ''),
      COALESCE((SELECT MAX(sub.updated_at) FROM client_saas_subscriptions sub WHERE sub.client_id = c.id), '')
    ) AS last_activity
  FROM clients c`;

const INACTIVE_STATUSES = new Set(["canceled", "cancelled", "inactive", "paused", "churned", "unpaid", "incomplete_expired"]);

function isActive(row: ClientRow): boolean {
  const status = (row.sub_status ?? row.link_status ?? "active").toLowerCase();
  return !INACTIVE_STATUSES.has(status);
}

function ageMs(iso: string | null, now: number): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? Infinity : now - t;
}

function leadStatus(row: ClientRow, now: number): "nuevo" | "activo" | "en_riesgo" {
  if (ageMs(row.created_at, now) < 7 * DAY_MS) return "nuevo";
  if (!isActive(row) || ageMs(row.last_activity, now) > 30 * DAY_MS) return "en_riesgo";
  return "activo";
}

function errorResponse(error: unknown, label: string) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  const dbError = respondDatabaseError(error);
  if (dbError) return dbError;
  console.error(label, error);
  return NextResponse.json({ ok: false, error: "CRM_UNAVAILABLE" }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    await requireOwnerAccess(request);
    const now = Date.now();
    const rows = await queryAll<ClientRow>(`${CLIENTS_SQL} ORDER BY c.created_at DESC`);

    const active = rows.filter(isActive);
    const pricedActive = active.filter((r) => crmPlanPrice(r.plan) > 0);
    const mrr = pricedActive.reduce((sum, r) => sum + crmPlanPrice(r.plan), 0);
    const avgPlan = pricedActive.length ? mrr / pricedActive.length : 0;
    const leadsThisWeek = rows.filter((r) => ageMs(r.created_at, now) < 7 * DAY_MS).length;

    // Churn del mes: suscripciones canceladas este mes / (activas + canceladas este mes).
    const monthStart = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1)).toISOString();
    const churn = await queryOne<{ canceled: number; active: number }>(
      `SELECT
         SUM(CASE WHEN status IN ('canceled', 'cancelled') AND updated_at >= ? THEN 1 ELSE 0 END) AS canceled,
         SUM(CASE WHEN status IN ('active', 'trialing', 'past_due') THEN 1 ELSE 0 END) AS active
       FROM client_saas_subscriptions`,
      monthStart,
    );
    const canceled = Number(churn?.canceled ?? 0);
    const churnBase = canceled + Number(churn?.active ?? 0);

    return NextResponse.json({
      ok: true,
      metrics: {
        activeClients: active.length,
        mrr,
        avgPlan,
        leadsThisWeek,
        churnRate: churnBase > 0 ? canceled / churnBase : 0,
      },
      leads: rows.slice(0, 10).map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        plan: r.plan,
        createdAt: r.created_at,
        status: leadStatus(r, now),
      })),
      plans: CRM_PLANS,
    });
  } catch (error) {
    return errorResponse(error, "OPERATOR_CRM_GET_ERROR");
  }
}
