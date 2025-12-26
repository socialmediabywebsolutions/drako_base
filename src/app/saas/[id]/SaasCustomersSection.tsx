"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import { Field, TextArea, TextInput } from "@/components/ui/input";
import type { SaasCustomer, SaasCustomerBooking, SaasCustomerMetrics, SaasCustomerProfile } from "@/lib/customers/types";
import SaasCustomerPartnerPanel from "@/app/saas/[id]/SaasCustomerPartnerPanel";

type Props = {
  saasId: string | null;
};

type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  currentPrice: number;
};

type BookingWithContext = SaasCustomerBooking & {
  service?: { name: string };
  employee?: { fullName?: string } | null;
};

export default function SaasCustomersSection({ saasId }: Props) {
  const [customers, setCustomers] = useState<SaasCustomer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingWithContext[]>([]);
  const [metrics, setMetrics] = useState<SaasCustomerMetrics | null>(null);
  const [metricsMap, setMetricsMap] = useState<Record<string, SaasCustomerMetrics | null>>({});
  const [profileMap, setProfileMap] = useState<Record<string, SaasCustomerProfile | null>>({});
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [bookingFormOpen, setBookingFormOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({ serviceId: "", startTime: "", notes: "", employeeId: "" });
  const [partnerCustomerId, setPartnerCustomerId] = useState<string | null>(null);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === selectedId) ?? null, [customers, selectedId]);

  const loadCustomers = useCallback(async () => {
    if (!saasId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/customers?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: SaasCustomer[] };
      const list = data.items ?? [];
      setCustomers(list);
      void Promise.all(
        list.map(async (customer) => {
          try {
            const detailRes = await fetch(`/api/customers/${encodeURIComponent(customer.id)}?saasId=${encodeURIComponent(saasId)}`, {
              cache: "no-store",
            });
            const detailJson = (await detailRes.json().catch(() => null)) as {
              metrics?: SaasCustomerMetrics;
              profile?: SaasCustomerProfile | null;
            } | null;
            setMetricsMap((prev) => ({ ...prev, [customer.id]: detailJson?.metrics ?? null }));
            setProfileMap((prev) => ({ ...prev, [customer.id]: detailJson?.profile ?? null }));
          } catch {
            setMetricsMap((prev) => ({ ...prev, [customer.id]: prev[customer.id] ?? null }));
          }
        }),
      );
      setSelectedId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, [saasId]);

  const loadServices = useCallback(async () => {
    if (!saasId) return;
    try {
      const res = await fetch(`/api/economy/services?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items?: ServiceOption[] };
      setServices(data.items ?? []);
    } catch {
      setServices([]);
    }
  }, [saasId]);

  const loadCustomerDetail = useCallback(
    async (customerId: string | null) => {
      if (!saasId || !customerId) {
        setBookings([]);
        setMetrics(null);
        return;
      }
      setDetailLoading(true);
      try {
        const [detailRes, bookingsRes] = await Promise.all([
          fetch(`/api/customers/${encodeURIComponent(customerId)}?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" }),
          fetch(`/api/customers/${encodeURIComponent(customerId)}/bookings?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" }),
        ]);
        const detailJson = (await detailRes.json()) as { metrics?: SaasCustomerMetrics; profile?: SaasCustomerProfile | null };
        const bookingsJson = (await bookingsRes.json()) as { items?: BookingWithContext[] };
        setMetrics(detailJson.metrics ?? null);
        setProfileMap((prev) => ({ ...prev, [customerId]: detailJson.profile ?? null }));
        setBookings(bookingsJson.items ?? []);
      } finally {
        setDetailLoading(false);
      }
    },
    [saasId],
  );

  useEffect(() => {
    void loadCustomers();
    void loadServices();
  }, [loadCustomers, loadServices]);

  useEffect(() => {
    void loadCustomerDetail(selectedId);
  }, [loadCustomerDetail, selectedId]);

  const revenueFormatter = useMemo(() => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }), []);

  function summarizePreferences(customer: SaasCustomer, profile: SaasCustomerProfile | null): string {
    const tone = profile?.preferences && typeof profile.preferences["tone"] === "string" ? profile.preferences["tone"] : null;
    if (tone) return `Tono: ${tone}`;
    const favorite = customer.styleProfile?.favoriteColors?.[0];
    if (favorite) return `Color: ${favorite}`;
    const eventType = customer.styleProfile?.eventType;
    if (eventType) return `Evento: ${eventType}`;
    const note = customer.notes?.split(".")[0]?.trim();
    return note || "—";
  }

  async function toggleVip(customer: SaasCustomer) {
    if (!saasId) return;
    await fetch(`/api/customers/${encodeURIComponent(customer.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        saasId,
        isVip: !customer.isVip,
        vipLevel: customer.isVip ? "REGULAR" : "VIP",
        fullName: customer.fullName,
      }),
    });
    await loadCustomers();
  }

  async function submitBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saasId || !selectedCustomer || !bookingForm.serviceId || !bookingForm.startTime) return;
    const service = services.find((s) => s.id === bookingForm.serviceId);
    const start = new Date(bookingForm.startTime);
    const end = new Date(start.getTime() + (service?.durationMinutes ?? 60) * 60 * 1000);
    await fetch(`/api/customers/${encodeURIComponent(selectedCustomer.id)}/bookings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        saasId,
        serviceId: bookingForm.serviceId,
        employeeId: bookingForm.employeeId || null,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        notes: bookingForm.notes || null,
        status: "CONFIRMED",
      }),
    });
    setBookingForm({ serviceId: "", startTime: "", notes: "", employeeId: "" });
    setBookingFormOpen(false);
    await loadCustomerDetail(selectedCustomer.id);
  }

  return (
    <>
      <section className="space-y-4" aria-label="Clientes">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">Clientes</p>
          <h2 className="text-xl font-semibold">Reservas y perfiles</h2>
          <p className="text-sm text-[var(--muted)]">Gestiona clientas, citas y métricas conectadas con Economy.</p>
        </div>
        <Button onClick={loadCustomers} variant="ghost">
          Refrescar
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card tone="glass" title="Listado de clientes" className="xl:col-span-1">
          {loading ? (
            <p className="text-sm text-[var(--muted)]">Cargando clientes...</p>
          ) : customers.length === 0 ? (
            <EmptyState title="Sin clientes" subtitle="Añade la primera clienta para empezar a reservar" />
          ) : (
            <div className="overflow-x-auto">
              <table className="modern text-sm" aria-label="Tabla de clientes">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Nº citas</th>
                    <th>Última visita</th>
                    <th>Preferencias</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className={selectedId === customer.id ? "bg-[var(--panel-alt)]" : ""}
                      onClick={() => setSelectedId(customer.id)}
                    >
                      <td className="font-semibold">
                        {customer.fullName}
                        {customer.vipLevel !== "REGULAR" && (
                          <Badge className="ml-2" variant={customer.vipLevel === "VVIP" ? "err" : "ok"}>
                            {customer.vipLevel}
                          </Badge>
                        )}
                      </td>
                      <td>{customer.email ?? "—"}</td>
                      <td>{customer.phone ?? "—"}</td>
                      <td>{metricsMap[customer.id]?.totalVisits ?? "—"}</td>
                      <td>
                        {metricsMap[customer.id]?.lastVisitAt
                          ? new Date(metricsMap[customer.id]!.lastVisitAt!).toLocaleDateString("es-ES")
                          : "—"}
                      </td>
                      <td>{summarizePreferences(customer, profileMap[customer.id] ?? null)}</td>
                      <td>
                        <Button variant="ghost" onClick={(event) => {
                          event.stopPropagation();
                          setPartnerCustomerId(customer.id);
                        }}>
                          Ver asistente
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card tone="glass" title="Detalle" className="xl:col-span-2">
          {detailLoading && <p className="text-sm text-[var(--muted)]">Cargando detalle...</p>}
          {!selectedCustomer && !detailLoading && <EmptyState title="Selecciona un cliente" subtitle="Elige un cliente para ver sus reservas" />}
          {selectedCustomer && !detailLoading && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{selectedCustomer.fullName}</h3>
                  <p className="text-sm text-[var(--muted)]">{selectedCustomer.email ?? "Sin email"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={selectedCustomer.vipLevel === "VVIP" ? "err" : selectedCustomer.vipLevel === "VIP" ? "ok" : "neutral"}>
                    {selectedCustomer.vipLevel}
                  </Badge>
                  <Button variant="ghost" onClick={() => toggleVip(selectedCustomer)}>
                    {selectedCustomer.isVip ? "Quitar VIP" : "Marcar VIP"}
                  </Button>
                  <Button variant="ghost" onClick={() => setPartnerCustomerId(selectedCustomer.id)}>
                    Abrir Partner
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card tone="glass" title="Visitas" className="!p-3">
                  <p className="text-xl font-semibold">{metrics?.totalVisits ?? 0}</p>
                </Card>
                <Card tone="glass" title="Ingresos" className="!p-3">
                  <p className="text-xl font-semibold">{revenueFormatter.format(metrics?.totalRevenue ?? 0)}</p>
                </Card>
                <Card tone="glass" title="Ticket medio" className="!p-3">
                  <p className="text-xl font-semibold">
                    {metrics?.avgTicket ? revenueFormatter.format(metrics.avgTicket) : revenueFormatter.format(0)}
                  </p>
                </Card>
                <Card tone="glass" title="Última visita" className="!p-3">
                  <p className="text-sm font-semibold">
                    {metrics?.lastVisitAt ? new Date(metrics.lastVisitAt).toLocaleDateString() : "Pendiente"}
                  </p>
                </Card>
              </div>

              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">Bookings</h4>
                <Button variant="ghost" onClick={() => setBookingFormOpen((prev) => !prev)}>
                  {bookingFormOpen ? "Cerrar" : "Crear nueva cita"}
                </Button>
              </div>

              {bookingFormOpen && (
                <form onSubmit={submitBooking} className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-2xl border border-[var(--border)] p-3">
                  <Field label="Servicio">
                    <select
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm"
                      value={bookingForm.serviceId}
                      onChange={(e) => setBookingForm((prev) => ({ ...prev, serviceId: e.target.value }))}
                      required
                    >
                      <option value="">Selecciona servicio</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name} ({service.durationMinutes} min)
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Inicio">
                    <TextInput
                      type="datetime-local"
                      value={bookingForm.startTime}
                      onChange={(e) => setBookingForm((prev) => ({ ...prev, startTime: e.target.value }))}
                      required
                    />
                  </Field>
                  <Field label="Empleado (opcional)">
                    <TextInput
                      value={bookingForm.employeeId}
                      onChange={(e) => setBookingForm((prev) => ({ ...prev, employeeId: e.target.value }))}
                      placeholder="ID empleado"
                    />
                  </Field>
                  <Field label="Notas">
                    <TextArea
                      rows={1}
                      value={bookingForm.notes}
                      onChange={(e) => setBookingForm((prev) => ({ ...prev, notes: e.target.value }))}
                      placeholder="Preferencias rápidas"
                    />
                  </Field>
                  <div className="md:col-span-4 flex justify-end">
                    <Button type="submit">Guardar cita</Button>
                  </div>
                </form>
              )}

              {bookings.length === 0 ? (
                <EmptyState title="Sin bookings" subtitle="Añade la primera reserva para ver el histórico" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="modern text-sm" aria-label="Tabla de bookings">
                    <thead>
                      <tr>
                        <th>Servicio</th>
                        <th>Inicio</th>
                        <th>Estado</th>
                        <th>Empleado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((booking) => (
                        <tr key={booking.id}>
                          <td>{booking.service?.name ?? booking.serviceId}</td>
                          <td>{new Date(booking.startTime).toLocaleString()}</td>
                          <td>
                            <Badge variant={booking.status === "CONFIRMED" ? "ok" : booking.status === "DONE" ? "info" : "warn"}>
                              {booking.status}
                            </Badge>
                          </td>
                          <td>{booking.employee?.fullName ?? booking.employeeId ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
      </section>
      {partnerCustomerId && saasId ? (
        <SaasCustomerPartnerPanel customerId={partnerCustomerId} saasId={saasId} onClose={() => setPartnerCustomerId(null)} />
      ) : null}
    </>
  );
}
