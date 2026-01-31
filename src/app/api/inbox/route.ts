import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { ensureCampamentoBase } from "@/lib/campamento-base";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  buildInboxQuery,
  resolveInboxCompanyAlias,
  enrichInboxItemsWithCompany,
  type InboxMessage,
} from "@/lib/inbox/helpers";
// export const runtime = "edge"; // OpenNext Migration

function detectDepartment(subject: string | null, body: string): string | null {
  const haystack = `${subject ?? ""} ${body}`.toLowerCase();
  const includes = (keywords: string[]) => keywords.some((kw) => haystack.includes(kw));

  // Finanzas: priorizamos fiscal cuando se habla explícitamente de IVA, impuestos o modelos.
  if (includes(["iva", "modelo 303", "modelo 390", "impuesto", "hacienda", "tribut", "retencion", "fiscal", "facturacion", "factura"])) {
    return "core_tax";
  }

  // Presupuestos y pagos: enviamos a Contabilidad salvo que el texto pida trato comercial/ventas.
  if (includes(["presupuesto", "pago", "cobro", "tesoreria", "cashflow", "transferencia", "impago", "balance", "concilia"])) {
    if (includes(["cotizacion", "cliente", "compra", "renovacion", "demo", "propuesta"])) {
      return "core_sales";
    }
    return "core_acc";
  }

  if (includes(["instagram", "facebook", "campana", "publicacion", "redes", "ads", "marketing", "social", "community"])) {
    return "core_mkt";
  }

  if (includes(["contrato", "reclamacion", "denuncia", "devolucion", "garantia", "legal", "compliance", "litigio"])) {
    return "core_legal";
  }

  if (includes(["no funciona", "bug", "error", "caido", "incidencia", "soporte", "ticket", "averia"])) {
    return "core_support";
  }

  if (includes(["deploy", "release", "repo", "commit", "pipeline devops", "build", "pull request"])) {
    return "core_dev";
  }

  if (includes(["seguridad", "brecha", "credencial", "acceso", "ciber", "phishing", "intrusion", "vulnerabilidad"])) {
    return "core_sec";
  }

  if (includes(["subvencion", "ayuda", "grant", "programa", "convocatoria", "fondos europeos"])) {
    return "core_grants";
  }

  if (includes(["estrategia", "objetivo", "okr", "direccion", "prioridad corporativa"])) {
    return "core_dir";
  }

  if (includes(["agente", "cliente", "suscripcion", "renovacion", "demo", "pipeline"])) {
    return "core_sales";
  }

  if (haystack.includes("atencion") || haystack.includes("cliente")) return "core_sales";
  return null;
}

function buildPreview(subject: string | null, body: string): string {
  if (subject && subject.trim().length > 0) return subject.trim().slice(0, 160);
  return body.trim().slice(0, 160);
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
    await ensureCampamentoBase();
    const url = new URL(req.url);
    const channel = url.searchParams.get("channel");
    const status = url.searchParams.get("status");
    const saasId = url.searchParams.get("saas_id") ?? url.searchParams.get("company_id");
    const departmentId = url.searchParams.get("department_id");

    const { sql, params } = buildInboxQuery({ tenantId, channel, status, saasId, departmentId });
    const items = await queryAll<InboxMessage>(sql, ...params);
    const enriched = enrichInboxItemsWithCompany(items);
    return NextResponse.json({ items: enriched, count: enriched.length });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("INBOX_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    await ensureCampamentoBase();
    const body = (await req.json().catch(() => null)) as Partial<InboxMessage> & { channel?: "email" | "whatsapp"; direction?: "inbound" | "outbound" } | null;
    if (!body?.channel || !body.direction || !body.from_address || !body.to_address || !body.full_body) {
      return NextResponse.json({ error: "channel, direction, from_address, to_address y full_body son obligatorios" }, { status: 400 });
    }

    const departmentId = detectDepartment(body.subject ?? null, body.full_body ?? "");
    const saasId = resolveInboxCompanyAlias(body);
    const preview = buildPreview(body.subject ?? null, body.full_body ?? "");
    const id = globalThis.crypto?.randomUUID?.() ?? `inbox_${Date.now()}`;
    const ok = await run(
      `INSERT INTO inbox_messages (id, tenant_id, channel, direction, from_address, to_address, subject, body_preview, full_body, status, saas_id, department_id, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      id,
      tenantId,
      body.channel,
      body.direction,
      body.from_address,
      body.to_address,
      body.subject ?? null,
      preview,
      body.full_body,
      body.status ?? "nuevo",
      saasId,
      body.department_id ?? departmentId,
      body.tags ?? null
    );

    if (!ok) {
      return NextResponse.json({ error: "No se pudo registrar el mensaje" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, id, department_id: body.department_id ?? departmentId, company_id: saasId });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("INBOX_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    await ensureCampamentoBase();
    const body = (await req.json().catch(() => null)) as { id?: string; status?: string; department_id?: string } | null;
    if (!body?.id) {
      return NextResponse.json({ error: "id es obligatorio" }, { status: 400 });
    }
    const sets: string[] = [];
    const params: (string | null)[] = [];
    if (body.status) {
      sets.push("status = ?");
      params.push(body.status);
    }
    if (typeof body.department_id !== "undefined") {
      sets.push("department_id = ?");
      params.push(body.department_id ?? null);
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: "No hay cambios para aplicar" }, { status: 400 });
    }
    sets.push("updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))");
    params.push(body.id);
    params.push(tenantId);

    const ok = await run(`UPDATE inbox_messages SET ${sets.join(", ")} WHERE id = ? AND tenant_id = ?`, ...params);
    if (!ok) {
      return NextResponse.json({ error: "No se pudo actualizar el mensaje" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("INBOX_PATCH_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}
