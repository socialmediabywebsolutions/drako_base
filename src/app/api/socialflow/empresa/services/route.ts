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

    const name = service.name;
    const category = service.category ? ` (${service.category})` : "";
    const tarifa = service.tarifa?.trim() ? `💶 ${service.tarifa.trim()}` : null;
    const zona = service.zona?.trim() ? `📍 ${service.zona.trim()}` : null;
    const desc = service.description?.trim() || null;

    // Día 1 (~2h): Post presentación
    const post1At = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    // Día 2 (~28h): Carrusel explicativo
    const post2At = new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString();
    // Día 3 (~52h): Historia con CTA
    const post3At = new Date(Date.now() + 52 * 60 * 60 * 1000).toISOString();
    // Día 5 (~116h): Reel de transformación
    const post4At = new Date(Date.now() + 116 * 60 * 60 * 1000).toISOString();

    const pieces: Parameters<typeof upsertSaasSocialPost>[1][] = [
      {
        saasId,
        channelId: null,
        campaignId: null,
        provider,
        contentType: "FEED",
        title: `Lanzamiento: ${name}`,
        body: [
          `✨ ¡Nuevo servicio disponible! ${name}${category}`,
          desc,
          tarifa,
          zona,
          "Reserva ya y descúbrelo. 👇",
        ].filter((l): l is string => Boolean(l)).join("\n\n"),
        imageHint: `Foto profesional presentando el servicio "${name}"`,
        status: "SCHEDULED",
        scheduledAt: post1At,
        postedAt: null,
        externalPostId: null,
        creationMode: "AUTO",
        metadata: { linkedServiceId: service.id, source: "service_launch_1_post" },
      },
      {
        saasId,
        channelId: null,
        campaignId: null,
        provider,
        contentType: "CAROUSEL",
        title: `Carrusel: qué incluye ${name}`,
        body: [
          `¿Qué incluye ${name}${category}? 🧵`,
          desc,
          "Slide 1: Qué es y para quién es.",
          "Slide 2: Qué obtienes exactamente.",
          "Slide 3: Cómo funciona el proceso.",
          "Slide 4: Precio y cómo reservar.",
          tarifa,
        ].filter((l): l is string => Boolean(l)).join("\n\n"),
        imageHint: `Serie de slides explicando el servicio "${name}" de forma visual y clara`,
        status: "SCHEDULED",
        scheduledAt: post2At,
        postedAt: null,
        externalPostId: null,
        creationMode: "AUTO",
        metadata: { linkedServiceId: service.id, source: "service_launch_2_carousel" },
      },
      {
        saasId,
        channelId: null,
        campaignId: null,
        provider,
        contentType: "STORY",
        title: `Historia CTA: ${name}`,
        body: [
          `¿Te interesa ${name}?`,
          tarifa,
          zona,
          "Desliza arriba o escríbenos ahora. ⬆️",
        ].filter((l): l is string => Boolean(l)).join("\n\n"),
        imageHint: `Historia llamativa con CTA directo para reservar el servicio "${name}"`,
        status: "SCHEDULED",
        scheduledAt: post3At,
        postedAt: null,
        externalPostId: null,
        creationMode: "AUTO",
        metadata: { linkedServiceId: service.id, source: "service_launch_3_story" },
      },
      {
        saasId,
        channelId: null,
        campaignId: null,
        provider,
        contentType: "REEL",
        title: `Reel: transformación con ${name}`,
        body: [
          `¿Cómo cambia tu vida con ${name}${category}? 🎬`,
          desc,
          "Mira el antes y el después. La diferencia es real.",
          tarifa,
          "Escríbenos y empieza hoy. 👇",
        ].filter((l): l is string => Boolean(l)).join("\n\n"),
        imageHint: `Reel dinámico mostrando la transformación o resultado del servicio "${name}"`,
        status: "SCHEDULED",
        scheduledAt: post4At,
        postedAt: null,
        externalPostId: null,
        creationMode: "AUTO",
        metadata: { linkedServiceId: service.id, source: "service_launch_4_reel" },
      },
    ];

    for (const piece of pieces) {
      await upsertSaasSocialPost(ctx, piece);
    }

    console.log("[Services] campaña de lanzamiento programada", { tenantId, serviceId: service.id, pieces: pieces.length });
  } catch (err) {
    console.error("[Services] auto announcement campaign failed", err instanceof Error ? err.message : String(err));
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
