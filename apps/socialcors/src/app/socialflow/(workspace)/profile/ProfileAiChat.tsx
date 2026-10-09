"use client";

import { useEffect, useRef, useState } from "react";
import { Field, MiniList, SelectField, TagField, TextareaField } from "./ProfileFormFields";

type ChatMessage = { role: "user" | "assistant"; content: string };

type ProposedCompetitor = {
  name: string;
  handle: string | null;
  platform: string | null;
  niche: string | null;
};

type ChatTurnResponse = {
  ok: boolean;
  assistantMessage?: string;
  extractedFields?: Record<string, unknown>;
  proposedFields?: Record<string, unknown>;
  proposedCompetitors?: ProposedCompetitor[];
  done?: boolean;
  error?: string;
  message?: string;
};

type ProfileAiChatProps = {
  initialProfile: any;
  onClose: () => void;
  onSave: (finalProfile: any, newCompetitors: Array<Record<string, unknown>>) => Promise<void>;
};

function applyPatch(base: any, patch: Record<string, unknown> | undefined): any {
  if (!patch) return base;
  const next = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length) next[key] = value;
    } else if (typeof value === "string") {
      if (value.trim()) next[key] = value;
    } else {
      next[key] = value;
    }
  }
  return next;
}

function LoadingDots() {
  return (
    <span className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]/70"
          style={{ animation: `chat-dot-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </span>
  );
}

export default function ProfileAiChat(props: ProfileAiChatProps) {
  const [phase, setPhase] = useState<"chat" | "review">("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftProfile, setDraftProfile] = useState<any>(() => JSON.parse(JSON.stringify(props.initialProfile ?? {})));
  const [proposedCompetitors, setProposedCompetitors] = useState<ProposedCompetitor[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void sendTurn(null, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendTurn(userMessage: string | null, historyOverride?: ChatMessage[]) {
    setLoading(true);
    setError(null);
    const history = historyOverride ?? messages;
    try {
      const res = await fetch("/api/socialflow/profile/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history, userMessage }),
      });
      const json: ChatTurnResponse = await res.json();
      if (!json.ok) {
        setError(json.message || json.error || "No se pudo continuar la conversación.");
        return;
      }

      setDraftProfile((prev: any) => applyPatch(applyPatch(prev, json.extractedFields), json.proposedFields));
      if (json.proposedCompetitors?.length) {
        setProposedCompetitors((prev) => {
          const byName = new Map(prev.map((c) => [c.name.toLowerCase(), c]));
          for (const c of json.proposedCompetitors!) {
            if (c?.name) byName.set(c.name.toLowerCase(), c);
          }
          return Array.from(byName.values());
        });
      }
      if (json.assistantMessage) {
        setMessages((prev) => [...prev, { role: "assistant", content: json.assistantMessage! }]);
      }
      if (json.done) {
        setPhase("review");
      }
    } catch (e: any) {
      setError(e?.message || "Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    const nextHistory: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextHistory);
    setInput("");
    void sendTurn(text, nextHistory);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleConfirmSave() {
    setSaving(true);
    setError(null);
    try {
      const competitorsPayload = proposedCompetitors.map((c) => ({
        name: c.name,
        handle: c.handle,
        platform: c.platform || "other",
        niche: c.niche,
      }));
      await props.onSave(draftProfile, competitorsPayload);
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  const p = draftProfile || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4">
      <style>{`
        @keyframes chat-dot-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-black/10">
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(6,182,212,0.15) 100%)" }}
        >
          <div>
            <p className="text-sm font-black text-gray-900">✨ Rellenar perfil con IA</p>
            <p className="text-[11px] text-gray-400">
              {phase === "chat" ? "Cuéntame sobre tu marca en tus palabras." : "Revisa y ajusta antes de guardar."}
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-900"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {phase === "chat" ? (
          <>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={[
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                      msg.role === "user"
                        ? "rounded-br-sm bg-[#3b82f6] text-white"
                        : "rounded-bl-sm bg-gray-100 text-gray-900",
                    ].join(" ")}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-start">
                  <div className="rounded-2xl rounded-bl-sm bg-gray-100 px-3.5 py-2.5">
                    <LoadingDots />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            {error && <p className="px-5 pb-2 text-xs text-red-600">{error}</p>}
            <div className="flex items-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                rows={2}
                placeholder="Escribe tu respuesta... (Enter para enviar, Shift+Enter para salto de línea)"
                className="flex-1 resize-none rounded-xl bg-gray-100 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:bg-gray-200 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="inline-flex h-9 shrink-0 items-center rounded-xl bg-[#3b82f6] px-4 text-sm font-semibold text-white transition hover:bg-[#2563eb] disabled:opacity-40"
              >
                Enviar
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              <p className="text-xs text-gray-400">
                Esto es lo que voy a guardar. Puedes corregir cualquier campo antes de confirmar.
              </p>

              <ReviewSection title="Identidad de marca">
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <Field label="Nombre de marca" value={p.brandName} onChange={(v) => setDraftProfile({ ...p, brandName: v })} />
                  <Field label="Idioma principal" value={p.primaryLanguage} onChange={(v) => setDraftProfile({ ...p, primaryLanguage: v })} />
                </div>
                <TextareaField label="Descripción corta" value={p.shortDescription} onChange={(v) => setDraftProfile({ ...p, shortDescription: v })} />
                <TextareaField label="Descripción larga" value={p.longDescription} onChange={(v) => setDraftProfile({ ...p, longDescription: v })} />
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <TextareaField label="Misión" value={p.mission} onChange={(v) => setDraftProfile({ ...p, mission: v })} />
                  <TextareaField label="Propuesta de valor" value={p.valueProposition} onChange={(v) => setDraftProfile({ ...p, valueProposition: v })} />
                </div>
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <TextareaField label="Tono de comunicación" value={p.toneOfVoice} onChange={(v) => setDraftProfile({ ...p, toneOfVoice: v })} />
                  <TextareaField label="Personalidad" value={p.personality} onChange={(v) => setDraftProfile({ ...p, personality: v })} />
                </div>
                <TagField label="Mercados objetivo" value={p.targetMarkets} onChange={(v) => setDraftProfile({ ...p, targetMarkets: v })} />
              </ReviewSection>

              <ReviewSection title="Nicho y temas">
                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <Field label="Nicho principal" value={p.niche} onChange={(v) => setDraftProfile({ ...p, niche: v })} />
                  <TagField label="Subnichos" value={p.subniches} onChange={(v) => setDraftProfile({ ...p, subniches: v })} />
                  <TagField label="Temas principales" value={p.mainTopics} onChange={(v) => setDraftProfile({ ...p, mainTopics: v })} />
                </div>
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <TagField label="Temas prohibidos" value={p.forbiddenTopics} onChange={(v) => setDraftProfile({ ...p, forbiddenTopics: v })} />
                  <TagField label="Temas permitidos" value={p.allowedTopics} onChange={(v) => setDraftProfile({ ...p, allowedTopics: v })} />
                </div>
              </ReviewSection>

              <ReviewSection title="Audiencia">
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <TextareaField label="Descripción de audiencia" value={p.audienceDescription} onChange={(v) => setDraftProfile({ ...p, audienceDescription: v })} />
                  <TextareaField label="Buyer persona" value={p.buyerPersona} onChange={(v) => setDraftProfile({ ...p, buyerPersona: v })} />
                </div>
                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <TagField label="Pain points" value={p.painPoints} onChange={(v) => setDraftProfile({ ...p, painPoints: v })} />
                  <TagField label="Deseos" value={p.desires} onChange={(v) => setDraftProfile({ ...p, desires: v })} />
                  <TagField label="Objeciones" value={p.objections} onChange={(v) => setDraftProfile({ ...p, objections: v })} />
                </div>
              </ReviewSection>

              <ReviewSection title="Negocio y ofertas">
                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <TagField label="Productos" value={p.products} onChange={(v) => setDraftProfile({ ...p, products: v })} />
                  <TagField label="Servicios" value={p.services} onChange={(v) => setDraftProfile({ ...p, services: v })} />
                  <TagField label="Ofertas" value={p.offers} onChange={(v) => setDraftProfile({ ...p, offers: v })} />
                </div>
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <TagField label="Transformaciones" value={p.transformations} onChange={(v) => setDraftProfile({ ...p, transformations: v })} />
                  <TagField label="Diferenciadores" value={p.differentiators} onChange={(v) => setDraftProfile({ ...p, differentiators: v })} />
                </div>
              </ReviewSection>

              <ReviewSection title="Keywords y hashtags">
                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <TagField label="Keywords base" value={p.baseKeywords} onChange={(v) => setDraftProfile({ ...p, baseKeywords: v })} />
                  <TagField label="Keywords prioritarias" value={p.priorityKeywords} onChange={(v) => setDraftProfile({ ...p, priorityKeywords: v })} />
                  <TagField label="Hashtags base" value={p.baseHashtags} onChange={(v) => setDraftProfile({ ...p, baseHashtags: v })} />
                </div>
              </ReviewSection>

              <ReviewSection title="Objetivos y estilo">
                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <Field label="Objetivo de seguidores" value={p.growthGoalFollowers ?? ""} onChange={(v) => setDraftProfile({ ...p, growthGoalFollowers: v ? Number(v) : null })} />
                  <Field label="Plazo del objetivo" value={p.growthGoalTimeline} onChange={(v) => setDraftProfile({ ...p, growthGoalTimeline: v })} />
                  <Field label="Frecuencia (posts/semana)" value={p.postingFrequency ?? ""} onChange={(v) => setDraftProfile({ ...p, postingFrequency: v ? Number(v) : null })} />
                </div>
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  <SelectField
                    label="Rango de edad"
                    value={p.ageRange}
                    onChange={(v) => setDraftProfile({ ...p, ageRange: v })}
                    options={[
                      { value: "18-25", label: "18-25" },
                      { value: "25-35", label: "25-35" },
                      { value: "35-45", label: "35-45" },
                      { value: "45+", label: "45+" },
                    ]}
                  />
                  <SelectField
                    label="Estilo visual predominante"
                    value={p.contentStyle}
                    onChange={(v) => setDraftProfile({ ...p, contentStyle: v })}
                    options={[
                      { value: "minimalista", label: "Minimalista" },
                      { value: "colorido", label: "Colorido" },
                      { value: "profesional", label: "Profesional" },
                      { value: "casual", label: "Casual" },
                      { value: "lifestyle", label: "Lifestyle" },
                    ]}
                  />
                </div>
              </ReviewSection>

              {proposedCompetitors.length > 0 && (
                <ReviewSection title="Competidores sugeridos">
                  <div className="space-y-2">
                    {proposedCompetitors.map((c, i) => (
                      <div key={`${c.name}-${i}`} className="grid gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm md:grid-cols-4">
                        <Field
                          label="Nombre"
                          value={c.name}
                          onChange={(v) => setProposedCompetitors((prev) => prev.map((x, xi) => (xi === i ? { ...x, name: v } : x)))}
                        />
                        <Field
                          label="Handle"
                          value={c.handle}
                          onChange={(v) => setProposedCompetitors((prev) => prev.map((x, xi) => (xi === i ? { ...x, handle: v } : x)))}
                        />
                        <Field
                          label="Nicho"
                          value={c.niche}
                          onChange={(v) => setProposedCompetitors((prev) => prev.map((x, xi) => (xi === i ? { ...x, niche: v } : x)))}
                        />
                        <button
                          type="button"
                          onClick={() => setProposedCompetitors((prev) => prev.filter((_, xi) => xi !== i))}
                          className="mt-5 h-fit rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                </ReviewSection>
              )}

              <MiniList title="Keywords propuestas (referencia)" items={p.longTailKeywords} />
            </div>
            {error && <p className="px-5 pb-2 text-xs text-red-600">{error}</p>}
            <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setPhase("chat")}
                className="text-xs text-gray-400 hover:text-gray-700"
              >
                ← Volver a la conversación
              </button>
              <button
                type="button"
                onClick={handleConfirmSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#3b82f6]/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar perfil del canal"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ReviewSection(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <h3 className="text-sm font-bold text-gray-900">{props.title}</h3>
      {props.children}
    </section>
  );
}
