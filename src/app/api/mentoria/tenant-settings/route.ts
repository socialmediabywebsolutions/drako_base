export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

// GET  /api/mentoria/tenant-settings — obtener configuración del tenant
// PATCH /api/mentoria/tenant-settings — actualizar configuración (solo owner)

export type TenantSettings = {
  tenantId: string;
  centerName: string;
  contactEmail: string;
  contactPhone: string;
  whatsappNumber: string;
  timezone: string;
  language: string;
  welcomeMessage: string;
  logoUrl: string | null;
  updatedAt: string;
};

type SettingsRow = {
  tenant_id: string;
  center_name: string;
  contact_email: string;
  contact_phone: string;
  whatsapp_number: string;
  timezone: string;
  language: string;
  welcome_message: string;
  logo_url: string | null;
  updated_at: string;
};

function rowToSettings(row: SettingsRow): TenantSettings {
  return {
    tenantId: row.tenant_id,
    centerName: row.center_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    whatsappNumber: row.whatsapp_number,
    timezone: row.timezone,
    language: row.language,
    welcomeMessage: row.welcome_message,
    logoUrl: row.logo_url,
    updatedAt: row.updated_at,
  };
}

export async function GET(req: NextRequest) {
  let actor;
  try {
    actor = await requireCurrentMentoriaSession(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (actor.role !== "owner" && actor.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  const result = await db
    .prepare(
      `SELECT tenant_id, center_name, contact_email, contact_phone, whatsapp_number, timezone, language, welcome_message, logo_url, updated_at
       FROM mentoria_tenant_settings
       WHERE tenant_id = ?
       LIMIT 1`,
    )
    .bind(actor.tenantId)
    .all();

  const row = (result.results?.[0] ?? null) as SettingsRow | null;

  // If no row exists yet, return defaults
  if (!row) {
    const defaults: TenantSettings = {
      tenantId: actor.tenantId,
      centerName: "",
      contactEmail: "",
      contactPhone: "",
      whatsappNumber: "",
      timezone: "Europe/Madrid",
      language: "es",
      welcomeMessage: "",
      logoUrl: null,
      updatedAt: new Date().toISOString(),
    };
    return NextResponse.json({ settings: defaults });
  }

  return NextResponse.json({ settings: rowToSettings(row) });
}

export async function PATCH(req: NextRequest) {
  let actor;
  try {
    actor = await requireCurrentMentoriaSession(req);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (actor.role !== "owner") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const db = getMentoriaDb();
  if (!db) return NextResponse.json({ error: "db_unavailable" }, { status: 503 });

  type Body = {
    centerName?: string;
    contactEmail?: string;
    contactPhone?: string;
    whatsappNumber?: string;
    timezone?: string;
    language?: string;
    welcomeMessage?: string;
    logoUrl?: string | null;
  };

  const payload = await req.json().catch(() => null) as Body | null;
  if (!payload) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const TIMEZONES = ["Europe/Madrid", "Europe/London", "America/New_York", "America/Mexico_City", "America/Bogota", "America/Lima", "America/Santiago", "America/Buenos_Aires"];
  const LANGUAGES = ["es", "en", "pt"];

  // Upsert settings
  await db
    .prepare(
      `INSERT INTO mentoria_tenant_settings (tenant_id, center_name, contact_email, contact_phone, whatsapp_number, timezone, language, welcome_message, logo_url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(tenant_id) DO UPDATE SET
         center_name     = CASE WHEN ? IS NOT NULL THEN ? ELSE center_name END,
         contact_email   = CASE WHEN ? IS NOT NULL THEN ? ELSE contact_email END,
         contact_phone   = CASE WHEN ? IS NOT NULL THEN ? ELSE contact_phone END,
         whatsapp_number = CASE WHEN ? IS NOT NULL THEN ? ELSE whatsapp_number END,
         timezone        = CASE WHEN ? IS NOT NULL THEN ? ELSE timezone END,
         language        = CASE WHEN ? IS NOT NULL THEN ? ELSE language END,
         welcome_message = CASE WHEN ? IS NOT NULL THEN ? ELSE welcome_message END,
         logo_url        = CASE WHEN ? IS NOT NULL THEN ? ELSE logo_url END,
         updated_at      = datetime('now')`,
    )
    .bind(
      // INSERT values
      actor.tenantId,
      payload.centerName?.trim() ?? "",
      payload.contactEmail?.trim() ?? "",
      payload.contactPhone?.trim() ?? "",
      payload.whatsappNumber?.trim() ?? "",
      TIMEZONES.includes(payload.timezone ?? "") ? (payload.timezone ?? "Europe/Madrid") : "Europe/Madrid",
      LANGUAGES.includes(payload.language ?? "") ? (payload.language ?? "es") : "es",
      payload.welcomeMessage?.trim() ?? "",
      payload.logoUrl ?? null,
      // UPDATE conditions
      payload.centerName !== undefined ? payload.centerName.trim() : null,
      payload.centerName?.trim() ?? "",
      payload.contactEmail !== undefined ? payload.contactEmail.trim() : null,
      payload.contactEmail?.trim() ?? "",
      payload.contactPhone !== undefined ? payload.contactPhone.trim() : null,
      payload.contactPhone?.trim() ?? "",
      payload.whatsappNumber !== undefined ? payload.whatsappNumber.trim() : null,
      payload.whatsappNumber?.trim() ?? "",
      payload.timezone !== undefined && TIMEZONES.includes(payload.timezone) ? payload.timezone : null,
      TIMEZONES.includes(payload.timezone ?? "") ? (payload.timezone ?? "Europe/Madrid") : "Europe/Madrid",
      payload.language !== undefined && LANGUAGES.includes(payload.language) ? payload.language : null,
      LANGUAGES.includes(payload.language ?? "") ? (payload.language ?? "es") : "es",
      payload.welcomeMessage !== undefined ? payload.welcomeMessage.trim() : null,
      payload.welcomeMessage?.trim() ?? "",
      payload.logoUrl !== undefined ? String(payload.logoUrl ?? "") : null,
      payload.logoUrl ?? null,
    )
    .run();

  return NextResponse.json({ ok: true });
}
