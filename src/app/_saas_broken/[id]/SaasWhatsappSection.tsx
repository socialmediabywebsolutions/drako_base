"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { TextArea, TextInput } from "@/components/ui/input";
import Select from "@/components/ui/select";
import EmptyState from "@/components/ui/empty-state";

type WhatsappIdentity = {
  id: string;
  actorType: string;
  actorId: string;
  phoneNumber: string;
  preferredLanguage: string | null;
  allowedChannels: string[] | null;
  consentFlags: string[] | null;
};

type Props = {
  saasId: string | null;
};

export default function SaasWhatsappSection({ saasId }: Props) {
  const [identities, setIdentities] = useState<WhatsappIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdentityId, setSelectedIdentityId] = useState<string>("");
  const [allowedChannels, setAllowedChannels] = useState("");
  const [consentFlags, setConsentFlags] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [demoIdentityId, setDemoIdentityId] = useState<string>("");
  const [demoBody, setDemoBody] = useState("");
  const [demoSending, setDemoSending] = useState(false);
  const [demoResponses, setDemoResponses] = useState<string[]>([]);
  const [demoError, setDemoError] = useState<string | null>(null);

  const selectedIdentity = useMemo(
    () => identities.find((item) => item.id === selectedIdentityId) ?? null,
    [identities, selectedIdentityId],
  );

  const demoIdentity = useMemo(
    () => identities.find((item) => item.id === demoIdentityId) ?? null,
    [identities, demoIdentityId],
  );

  const loadIdentities = useCallback(async () => {
    if (!saasId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ saasId });
      const res = await fetch(`/api/whatsapp/identities?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { items?: WhatsappIdentity[] } | null;
      const items = data?.items ?? [];
      setIdentities(items);
      setSelectedIdentityId((prev) => prev || items[0]?.id || "");
      setDemoIdentityId((prev) => prev || items[0]?.id || "");
    } catch {
      setIdentities([]);
    } finally {
      setLoading(false);
    }
  }, [saasId]);

  useEffect(() => {
    void loadIdentities();
  }, [loadIdentities]);

  useEffect(() => {
    if (!selectedIdentity) return;
    setAllowedChannels(selectedIdentity.allowedChannels?.join(", ") ?? "");
    setConsentFlags(selectedIdentity.consentFlags?.join(", ") ?? "");
  }, [selectedIdentity]);

  async function handleSave() {
    if (!saasId || !selectedIdentity) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const payload = {
        saasId,
        actorType: selectedIdentity.actorType,
        actorId: selectedIdentity.actorId,
        phoneNumber: selectedIdentity.phoneNumber,
        preferredLanguage: selectedIdentity.preferredLanguage,
        allowedChannels: allowedChannels
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        consentFlags: consentFlags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };
      const res = await fetch("/api/whatsapp/identities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("No se pudo guardar la identidad");
      await loadIdentities();
      setSaveMessage("Guardado");
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "No se pudo guardar la identidad");
    } finally {
      setSaving(false);
    }
  }

  async function sendDemoMessage() {
    if (!saasId || !demoIdentity || !demoBody.trim()) return;
    setDemoSending(true);
    setDemoError(null);
    setDemoResponses([]);
    try {
      const res = await fetch("/api/whatsapp/inbound", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          phoneNumber: demoIdentity.phoneNumber,
          body: demoBody.trim(),
          metadata: { source: "demo" },
        }),
      });
      if (!res.ok) throw new Error("No se pudo enviar el mensaje");
      const data = (await res.json().catch(() => null)) as { messages?: string[] } | null;
      setDemoResponses(data?.messages ?? []);
      setDemoBody("");
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "No se pudo enviar el mensaje");
    } finally {
      setDemoSending(false);
    }
  }

  return (
    <Card title="WhatsApp Gateway" subtitle="Identidades y pruebas internas (sin proveedor real)">
      {loading ? (
        <p className="text-sm text-[var(--muted)]">Cargando identidades...</p>
      ) : identities.length === 0 ? (
        <EmptyState title="Sin identidades" subtitle="Crea identidades para dueños, empleados y clientes." />
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--muted)]">Identidades registradas</p>
              <Badge variant="neutral">Total: {identities.length}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="modern text-sm" aria-label="WhatsApp identities">
                <thead>
                  <tr>
                    <th>Rol</th>
                    <th>Actor</th>
                    <th>Telefono</th>
                    <th>Canales</th>
                    <th>Consentimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {identities.map((identity) => (
                    <tr key={identity.id}>
                      <td>{identity.actorType}</td>
                      <td>{identity.actorId}</td>
                      <td>{identity.phoneNumber}</td>
                      <td>{identity.allowedChannels?.join(", ") ?? "—"}</td>
                      <td>{identity.consentFlags?.join(", ") ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel)]/40 p-4">
            <p className="text-sm font-semibold">Editar canales y consentimiento</p>
            <p className="text-xs text-[var(--muted)]">Selecciona una identidad para ajustar sus flags.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                Identidad
                <Select value={selectedIdentityId} onChange={(event) => setSelectedIdentityId(event.target.value)}>
                  {identities.map((identity) => (
                    <option key={identity.id} value={identity.id}>
                      {identity.actorType} · {identity.phoneNumber}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                Canales (coma separada)
                <TextInput value={allowedChannels} onChange={(event) => setAllowedChannels(event.target.value)} placeholder="APPOINTMENTS, TASKS" />
              </label>
              <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                Consentimientos (coma separada)
                <TextInput value={consentFlags} onChange={(event) => setConsentFlags(event.target.value)} placeholder="BASIC, MARKETING" />
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--muted)]">{saveMessage ?? "Los cambios aplican al gateway interno."}</p>
              <Button size="sm" onClick={handleSave} disabled={saving || !selectedIdentity}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel)]/40 p-4">
            <p className="text-sm font-semibold">Probar mensaje demo</p>
            <p className="text-xs text-[var(--muted)]">Simula un inbound WhatsApp y ve la respuesta.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-[220px,1fr]">
              <Select value={demoIdentityId} onChange={(event) => setDemoIdentityId(event.target.value)}>
                {identities.map((identity) => (
                  <option key={identity.id} value={identity.id}>
                    {identity.actorType} · {identity.phoneNumber}
                  </option>
                ))}
              </Select>
              <TextArea
                rows={2}
                value={demoBody}
                onChange={(event) => setDemoBody(event.target.value)}
                placeholder="menu / proxima cita / mi horario de hoy"
              />
            </div>
            {demoError && <p className="mt-2 text-xs text-[var(--danger)]">{demoError}</p>}
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button size="sm" onClick={sendDemoMessage} disabled={demoSending || !demoIdentity || !demoBody.trim()}>
                {demoSending ? "Enviando..." : "Enviar (modo demo)"}
              </Button>
            </div>
            {demoResponses.length > 0 && (
              <div className="mt-3 rounded-xl border border-[var(--border)]/60 bg-[var(--panel-alt)]/70 p-3 text-xs text-[var(--muted)]">
                {demoResponses.map((response, idx) => (
                  <p key={`${response}-${idx}`}>{response}</p>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-[var(--muted)]">
              Esta integracion es interna y no esta conectada a un proveedor real de WhatsApp.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--panel)]/40 p-4">
            <p className="text-sm font-semibold">Comandos disponibles (demo)</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel-alt)]/70 p-3 text-xs">
                <p className="text-[11px] font-semibold">Cliente</p>
                <ul className="mt-2 space-y-1 text-[var(--muted)]">
                  <li>• proxima cita</li>
                  <li>• tengo cita hoy</li>
                  <li>• confirmo mi cita</li>
                  <li>• cancelar mi cita</li>
                </ul>
              </div>
              <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel-alt)]/70 p-3 text-xs">
                <p className="text-[11px] font-semibold">Empleado</p>
                <ul className="mt-2 space-y-1 text-[var(--muted)]">
                  <li>• mi horario de hoy</li>
                  <li>• mi horario de esta semana</li>
                  <li>• mis tareas de hoy</li>
                </ul>
              </div>
              <div className="rounded-xl border border-[var(--border)]/60 bg-[var(--panel-alt)]/70 p-3 text-xs">
                <p className="text-[11px] font-semibold">Dueño</p>
                <ul className="mt-2 space-y-1 text-[var(--muted)]">
                  <li>• resumen de hoy</li>
                  <li>• tareas abiertas</li>
                  <li>• resumen impuestos</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
