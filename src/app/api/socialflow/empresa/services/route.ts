export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getServicesByTenant, createService } from "@/lib/socialflow/services/repository";
import { listSaasSocialAccounts, resolveSocialContext, upsertSaasSocialPost } from "@/lib/socialflow/repository";
import type { EmpresaService } from "@/lib/socialflow/services/types";
import type { SaasSocialProvider } from "@/lib/social-core/types";

const DEFAULT_SAAS_ID = "socialflow";

function resolveSaasId(request: Request): string {
  return new URL(request.url).searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

// Presenta el servicio recién creado con un post AUTO en el calendario, agendado
// dentro de las próximas 48h. Best-effort: nunca debe tumbar la creación del
// servicio si algo falla aquí (cuenta no conectada, DB, etc), solo se loguea.
async function scheduleServiceAnnouncementPost(
  tenantId: string,
  saasId: string,
  service: EmpresaService,
): Promise<void> {
  try {
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const accounts = await listSaasSocialAccounts(ctx);
    const connected = accounts.find((a) => a.status === "CONNECTED_REAL");
    const provider: SaasSocialProvider = connected?.provider ?? "INSTAGRAM";

    const bodyLines = [
      `✨ Nuevo servicio: ${service.name}${service.category ? ` (${service.category})` : ""}`,
      service.description?.trim() || null,
      service.tarifa?.trim() ? `💶 Tarifa: ${service.tarifa.trim()}` : null,
      service.zona?.trim() ? `📍 Zona: ${service.zona.trim()}` : null,
      "Reserva ya y descúbrelo.",
    ].filter((line): line is string => Boolean(line));

    // Entre 1h y 48h desde ahora — evita que todos los servicios creados a la vez
    // caigan exactamente en el mismo instante del calendario.
    const scheduledAt = new Date(Date.now() + (1 + Math.random() * 47) * 60 * 60 * 1000).toISOString();

    await upsertSaasSocialPost(ctx, {
      saasId,
      channelId: null,
      campaignId: null,
      provider,
      contentType: "FEED",
      title: `Nuevo servicio: ${service.name}`,
      body: bodyLines.join("\n\n"),
      imageHint: `Foto profesional presentando el servicio "${service.name}"`,
      status: "SCHEDULED",
      scheduledAt,
      postedAt: null,
      externalPostId: null,
      creationMode: "AUTO",
      metadata: { linkedServiceId: service.id, source: "service_created_auto_announcement" },
    });
  } catch (err) {
    console.error("[Services] auto announcement post failed", err instanceof Error ? err.message : String(err));
  }
}

export async function GET(req: Request) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  try {
    const services = await getServicesByTenant(session.tenantId, resolveSaasId(req));
    return NextResponse.json({ ok: true, services });
  } catch (err) {
    console.error("[Services] list failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "LIST_FAILED" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  let body: {
    name?: string;
    description?: string;
    category?: string;
    zona?: string;
    tarifa?: string;
    credentialDeclared?: boolean;
    credentialDescription?: string;
    active?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });
  }

  try {
    const saasId = resolveSaasId(req);
    const service = await createService(session.tenantId, saasId, {
      name,
      description: body.description?.trim() || null,
      category: body.category?.trim() || null,
      zona: body.zona?.trim() || null,
      tarifa: body.tarifa?.trim() || null,
      credentialDeclared: body.credentialDeclared,
      credentialDescription: body.credentialDescription?.trim() || null,
      active: body.active,
    });
    await scheduleServiceAnnouncementPost(session.tenantId, saasId, service);
    return NextResponse.json({ ok: true, service });
  } catch (err) {
    console.error("[Services] create failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 500 });
  }
}
