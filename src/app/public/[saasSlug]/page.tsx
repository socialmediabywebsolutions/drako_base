import Card from "@/components/ui/card";
import BookingForm from "@/app/public/[saasSlug]/BookingForm";
import { queryAll } from "@/lib/db";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import { resolveEconomyContext, listSaasServices } from "@/lib/economy/repository";
import { listDemoSaas, listDemoSaasServices } from "@/lib/admin/demo-data";
import type { SaasService } from "@/lib/economy/types";

type PageParams = {
  params: Promise<{ saasSlug: string }>;
};

function safeParseMetadata(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

async function resolveSaasMeta(saasSlug: string): Promise<{ saasId: string; tenantId: string; name: string; city: string | null } | null> {
  try {
    const rows = await queryAll<{ id: string; tenant_id: string; name: string; city?: string | null }>(
      "SELECT id, tenant_id, name FROM saas WHERE slug = ? LIMIT 1",
      saasSlug,
    );
    if (rows[0]) {
      return { saasId: rows[0].id, tenantId: rows[0].tenant_id ?? DEMO_TENANT_ID, name: rows[0].name, city: rows[0].city ?? null };
    }
  } catch {
    // ignore and fallback to demo
  }

  const demo = listDemoSaas(DEMO_TENANT_ID).find((item) => item.slug === saasSlug);
  if (demo) {
    return { saasId: demo.id, tenantId: DEMO_TENANT_ID, name: demo.name, city: "Barcelona" };
  }

  return null;
}

async function loadServices(meta: { saasId: string; tenantId: string }): Promise<SaasService[]> {
  try {
    const ctx = await resolveEconomyContext({ tenantId: meta.tenantId, saasId: meta.saasId });
    return await listSaasServices(ctx);
  } catch {
    return listDemoSaasServices(meta.tenantId ?? DEMO_TENANT_ID, meta.saasId).map((item) => ({
      id: item.id,
      tenantId: item.tenant_id,
      saasId: item.saas_id,
      name: item.name,
      slug: item.slug,
      category: item.category,
      durationMinutes: item.duration_minutes,
      currentPrice: item.current_price,
      recommendedPrice: item.recommended_price,
      isActive: item.is_active === 1,
      metadata: safeParseMetadata(item.metadata),
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }));
  }
}

export default async function PublicBookingPage({ params }: PageParams) {
  const { saasSlug } = await params;
  const saasMeta = await resolveSaasMeta(saasSlug);
  if (!saasMeta) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Card tone="glass" title="SaaS no encontrado" subtitle="Comprueba el enlace o contacta con soporte." />
      </div>
    );
  }

  const services = (await loadServices({ saasId: saasMeta.saasId, tenantId: saasMeta.tenantId })).filter((service) => service.isActive);
  const cityLabel = saasMeta.city ? ` • ${saasMeta.city}` : "";

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 p-6">
      <section className="relative overflow-hidden rounded-[32px] border border-[var(--border)] bg-[var(--panel)] p-8 shadow-xl">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[var(--brand)]/20 blur-2xl" />
        <div className="absolute -bottom-10 left-10 h-32 w-32 rounded-full bg-amber-200/20 blur-2xl" />
        <div className="relative space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Agenda en linea</p>
          <h1 className="text-4xl font-semibold">{saasMeta.name}</h1>
          <p className="max-w-xl text-base text-[var(--muted)]">
            Cita facil, agenda organizada y una experiencia premium en cada visita{cityLabel}.
          </p>
          <div className="flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>Colorimetria</span>
            <span>Tratamientos</span>
            <span>Venta retail</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card tone="glass" title="Servicios" subtitle="Duracion y precio" className="lg:col-span-2">
          {services.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Sin servicios publicados todavia.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {services.map((service) => (
                <div key={service.id} className="rounded-2xl border border-[var(--border)] bg-[var(--panel-alt)] p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{service.name}</p>
                    <span className="text-sm text-[var(--muted)]">{service.durationMinutes} min</span>
                  </div>
                  <p className="text-lg font-semibold">{service.currentPrice.toFixed(2)} €</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card tone="glass" title="Reserva tu cita" subtitle="En menos de 2 minutos">
          <BookingForm saasId={saasMeta.saasId} services={services} />
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card tone="glass" title="Beneficios">
          <ul className="space-y-2 text-sm text-[var(--muted)]">
            <li>Sin esperas gracias a la agenda inteligente.</li>
            <li>Recordatorios automaticos y confirmaciones rapidas.</li>
            <li>Servicios personalizados con historial de visitas.</li>
          </ul>
        </Card>
        <Card tone="glass" title="Venta retail" subtitle="Recomendado por estilistas">
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-alt)] p-3">
              <p className="font-semibold">Mascarilla reparadora</p>
              <p className="text-[var(--muted)]">Hidratacion profunda para color.</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-alt)] p-3">
              <p className="font-semibold">Shampoo sin sulfatos</p>
              <p className="text-[var(--muted)]">Protege el tono y brillo.</p>
            </div>
          </div>
        </Card>
        <Card tone="glass" title="Equipo experto" subtitle="Tratamientos seguros">
          <p className="text-sm text-[var(--muted)]">
            Coloristas certificados, protocolos de cuidado y un espacio pensado para que salgas con la mejor version de tu estilo.
          </p>
        </Card>
      </section>
    </div>
  );
}
