"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import { TextArea, TextInput } from "@/components/ui/input";

type Message = { id: string; sender: string; content: string; created_at: string };

type ReportLink = { id: string; type: string };

export default function OnboardingChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [statusText, setStatusText] = useState("Vamos a conocerte y montar tu SaaS.");
  const [data, setData] = useState<Record<string, string>>({});
  const [reportLinks, setReportLinks] = useState<ReportLink[]>([]);
  const [researchStatus, setResearchStatus] = useState<string>("Pendiente");
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [provisionStatus, setProvisionStatus] = useState<string>("Pendiente");

  useEffect(() => {
    (async () => {
      if (sessionId) return;
      const res = await fetch("/api/onboarding/session", { method: "POST" });
      const json = (await res.json()) as { session?: { id: string } };
      if (json.session?.id) {
        setSessionId(json.session.id);
        setMessages([
          {
            id: "welcome",
            sender: "orchestrator",
            content: "Soy tu orquestador. Te haré preguntas cortas y te explicaré cada paso.",
            created_at: new Date().toISOString(),
          },
        ]);
      }
    })();
  }, [sessionId]);

  const leftNav = useMemo(
    () => [
      { label: "Datos negocio", done: Boolean(data.businessName && data.idNumber) },
      { label: "Presencia digital", done: Boolean(data.web || data.social) },
      { label: "Research", done: researchStatus !== "Pendiente" },
      { label: "Reportes", done: reportLinks.length > 0 },
      { label: "Pago", done: checkoutId !== null },
      { label: "Provisión", done: provisionStatus === "Listo" },
    ],
    [data, researchStatus, reportLinks.length, checkoutId, provisionStatus]
  );

  async function sendChat(payload?: Record<string, string>) {
    if (!sessionId) return;
    setLoadingChat(true);
    const body: Record<string, unknown> = { sessionId, message: input || undefined };
    if (payload) body.data = payload;
    const res = await fetch("/api/onboarding/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { messages?: Message[]; nextPrompt?: string; why?: string };
    setLoadingChat(false);
    if (json.messages) setMessages(json.messages);
    if (json.nextPrompt) setStatusText(`${json.nextPrompt} ${json.why ? `(${json.why})` : ""}`);
    setInput("");
  }

  async function saveProfile() {
    await sendChat(data);
  }

  async function runResearch() {
    if (!sessionId) return;
    setResearchStatus("En curso");
    const res = await fetch("/api/research/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, address: data.address, radioKm: Number(data.radioKm ?? 2), industry: data.industry }),
    });
    const json = (await res.json()) as { status?: string };
    setResearchStatus(json.status ?? "requires_keys");
  }

  async function generateReports() {
    if (!sessionId) return;
    const res = await fetch("/api/reports/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, radioKm: Number(data.radioKm ?? 2), pack: data.recommendedPack ?? "BASIC" }),
    });
    const json = (await res.json()) as { reportIds?: string[] };
    if (json.reportIds) {
      setReportLinks(json.reportIds.map((id, idx) => ({ id, type: `reporte-${idx + 1}` })));
    }
  }

  async function startCheckout() {
    if (!sessionId) return;
    const res = await fetch("/api/checkout/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, amountCents: 14900 }),
    });
    const json = (await res.json()) as { id?: string };
    if (json.id) setCheckoutId(json.id);
  }

  async function confirmCheckoutAndProvision() {
    if (!sessionId || !checkoutId) return;
    await fetch("/api/checkout/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ checkoutId, sessionId }),
    });
    await fetch("/api/provision/commit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId,
        name: data.businessName ?? "Nuevo SaaS",
        slug: (data.businessName ?? "nuevo").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        packTier: data.recommendedPack ?? "BASIC",
      }),
    });
    setProvisionStatus("Listo");
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-sky-100 bg-white px-6 py-4 flex items-center justify-between shadow-sm">
        <div>
          <p className="text-sm text-sky-600 font-semibold">DRĀKO Systems</p>
          <h1 className="text-xl font-bold text-slate-900">Onboarding asistido</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="neutral">{statusText}</Badge>
          <Link href="/site"><Button variant="outline">Volver a la home</Button></Link>
        </div>
      </header>

      <div className="grid gap-4 px-4 py-6 lg:grid-cols-[280px,1fr,400px] max-h-screen">
        {/* izquierda */}
        <div className="space-y-4 overflow-y-auto">
          <Card title="Progreso">
            <ul className="space-y-2 text-sm">
              {leftNav.map((step) => (
                <li key={step.label} className="flex items-center justify-between">
                  <span>{step.label}</span>
                  <Badge variant={step.done ? "ok" : "neutral"}>{step.done ? "Listo" : "Pendiente"}</Badge>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Descargas">
            {reportLinks.length === 0 ? (
              <p className="text-sm text-slate-600">Genera los reportes para habilitar descargas.</p>
            ) : (
              <ul className="space-y-2">
                {reportLinks.map((r) => (
                  <li key={r.id}>
                    <Link className="text-sky-600 font-semibold underline hover:text-sky-700" href={`/api/reports/${r.id}/pdf`}>Descargar {r.type}</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Estado de research">
            <p className="text-sm text-slate-700 font-medium">{researchStatus}</p>
          </Card>
        </div>

        {/* centro */}
        <div className="space-y-4 overflow-y-auto">
          <Card title="Ficha rápida">
            <div className="grid gap-2 md:grid-cols-2">
              <TextInput placeholder="Nombre / razón social" value={data.businessName ?? ""} onChange={(e) => setData({ ...data, businessName: e.target.value })} />
              <TextInput placeholder="NIF/CIF" value={data.idNumber ?? ""} onChange={(e) => setData({ ...data, idNumber: e.target.value })} />
              <TextInput placeholder="Email" value={data.email ?? ""} onChange={(e) => setData({ ...data, email: e.target.value })} />
              <TextInput placeholder="Teléfono" value={data.phone ?? ""} onChange={(e) => setData({ ...data, phone: e.target.value })} />
              <TextInput placeholder="Dirección completa" value={data.address ?? ""} onChange={(e) => setData({ ...data, address: e.target.value })} />
              <TextInput placeholder="Ciudad y país" value={data.cityCountry ?? ""} onChange={(e) => setData({ ...data, cityCountry: e.target.value })} />
              <TextInput placeholder="Nicho / oficio" value={data.industry ?? ""} onChange={(e) => setData({ ...data, industry: e.target.value })} />
              <TextInput placeholder="Servicios y precios" value={data.services ?? ""} onChange={(e) => setData({ ...data, services: e.target.value })} />
              <TextInput placeholder="Horarios" value={data.schedule ?? ""} onChange={(e) => setData({ ...data, schedule: e.target.value })} />
              <TextInput placeholder="Objetivo principal" value={data.goals ?? ""} onChange={(e) => setData({ ...data, goals: e.target.value })} />
              <TextInput placeholder="Web" value={data.web ?? ""} onChange={(e) => setData({ ...data, web: e.target.value })} />
              <TextInput placeholder="Redes sociales" value={data.social ?? ""} onChange={(e) => setData({ ...data, social: e.target.value })} />
              <TextInput placeholder="Google Business Profile" value={data.gbp ?? ""} onChange={(e) => setData({ ...data, gbp: e.target.value })} />
              <TextInput placeholder="Presupuesto mensual (€)" value={data.budget ?? ""} onChange={(e) => setData({ ...data, budget: e.target.value })} />
              <TextInput placeholder="Equipo (personas)" value={data.team ?? ""} onChange={(e) => setData({ ...data, team: e.target.value })} />
              <TextInput placeholder="Herramientas actuales" value={data.tools ?? ""} onChange={(e) => setData({ ...data, tools: e.target.value })} />
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={saveProfile} variant="primary">Guardar ficha</Button>
              <Button onClick={runResearch} variant="secondary">Lanzar research</Button>
              <Button onClick={generateReports} variant="secondary">Generar PDFs</Button>
            </div>
          </Card>

          <Card title="Avance y acciones">
            <div className="flex flex-wrap gap-2">
              <Button onClick={startCheckout} variant="primary">Iniciar checkout demo</Button>
              <Button onClick={confirmCheckoutAndProvision} variant="secondary" disabled={!checkoutId}>Confirmar pago y provisionar</Button>
              <Link href="/site/panel"><Button variant="outline">Ver panel</Button></Link>
            </div>
            <p className="text-sm text-slate-600 mt-2">Pack recomendado y pasos se ajustan a tu presupuesto. Pagos demo marcan el flujo como &quot;paid&quot; para provisionar.</p>
          </Card>
        </div>

        {/* derecha chat - STICKY AT TOP */}
        <div className="space-y-3">
          <div className="sticky top-20">
            <Card title="Chat con tu orquestador">
              <div className="h-[500px] overflow-y-auto space-y-2 pr-1 mb-3">
                {messages.map((m) => (
                  <div key={m.id} className={`rounded-xl p-3 text-sm ${m.sender === "client" ? "bg-sky-50 text-slate-900 border border-sky-100" : "bg-emerald-50 text-emerald-900 border border-emerald-100"}`}>
                    <p className="text-[10px] uppercase tracking-wide opacity-70 font-bold mb-1">{m.sender}</p>
                    <p className="leading-relaxed">{m.content}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <TextArea placeholder={statusText} value={input} onChange={(e) => setInput(e.target.value)} />
                <Button onClick={() => sendChat()} disabled={loadingChat || !sessionId} variant="primary" className="w-full">
                  {loadingChat ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </Card>
            <Card title="Notas" className="mt-3">
              <p className="text-sm text-slate-600">El orquestador siempre explica el porqué de cada pregunta. Si faltan claves de APIs, verás &quot;requires_keys&quot; y un checklist para conectarlas.</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
