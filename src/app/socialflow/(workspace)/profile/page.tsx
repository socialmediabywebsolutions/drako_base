"use client";

import { useEffect, useState } from "react";
import { Field, MiniList, SelectField, sectionCls, TagField, TextareaField } from "./ProfileFormFields";
import ProfileAiChat from "./ProfileAiChat";

type ProfileResponse = {
  ok: boolean;
  profile?: any;
  competitors?: any[];
  assets?: any[];
  error?: string;
};

export default function SocialFlowProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [aiChatOpen, setAiChatOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/socialflow/profile");
        const json: ProfileResponse = await res.json();
        if (!json.ok) {
          if (!cancelled) setError(json.error || "No se pudo cargar el perfil");
        } else {
          if (!cancelled) {
            setProfile(json.profile || null);
            setCompetitors(json.competitors || []);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Error inesperado");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function onSaveProfile(overrideProfile?: any) {
    const toSave = overrideProfile ?? profile;
    if (!toSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/socialflow/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: toSave }),
      });
      const json: ProfileResponse = await res.json();
      if (!json.ok) {
        setError(json.error || "No se pudo guardar el perfil");
      } else {
        setProfile(json.profile || toSave);
      }
    } catch (e: any) {
      setError(e?.message || "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveFromAiChat(finalProfile: any, newCompetitors: Array<Record<string, unknown>>) {
    await onSaveProfile(finalProfile);
    for (const competitor of newCompetitors) {
      try {
        await fetch("/api/socialflow/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ competitor }),
        });
      } catch {
        // best-effort: a failed competitor save shouldn't block the profile save above
      }
    }
    if (newCompetitors.length) {
      try {
        const res = await fetch("/api/socialflow/profile");
        const json: ProfileResponse = await res.json();
        if (json.ok) setCompetitors(json.competitors || []);
      } catch {
        // ignore — competitors list will just refresh next page load
      }
    }
  }

  if (loading && !profile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-white/45">
        Cargando perfil del canal...
      </div>
    );
  }

  if (error && !profile) {
    return <div className="p-6 text-sm text-red-300">{error}</div>;
  }

  const p = profile || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-white/4 p-6">
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">SocialFlow · Perfil</div>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-white">Perfil del canal</h1>
        <p className="mb-5 mt-2 text-sm text-white/45">
          Este perfil entrena a los agentes IA de SocialFlow. Rellénalo con información real y estratégica sobre tu marca, audiencia y ofertas. La IA usará esto como su base de conocimiento principal.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => onSaveProfile()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
            {saving ? "Guardando..." : "Guardar perfil del canal"}
          </button>
          <button
            type="button"
            onClick={() => setAiChatOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/20"
          >
            ✨ Rellenar con IA
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      </div>

      {aiChatOpen && (
        <ProfileAiChat
          initialProfile={p}
          onClose={() => setAiChatOpen(false)}
          onSave={async (finalProfile, newCompetitors) => {
            await onSaveFromAiChat(finalProfile, newCompetitors);
            setAiChatOpen(false);
          }}
        />
      )}

      {/* Brand identity */}
      <section className={sectionCls}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white/90">Identidad de marca</h2>
          <span className="text-xs text-white/30">Quién eres y cómo suenas.</span>
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <Field label="Nombre de marca" value={p.brandName} onChange={(v) => setProfile({ ...p, brandName: v })} />
          <Field label="Handle del canal" value={p.channelName} onChange={(v) => setProfile({ ...p, channelName: v })} />
          <Field label="Idioma principal" value={p.primaryLanguage} onChange={(v) => setProfile({ ...p, primaryLanguage: v })} />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <TextareaField label="Descripción corta" placeholder="Una frase que explique de qué va este canal." value={p.shortDescription} onChange={(v) => setProfile({ ...p, shortDescription: v })} />
          <TextareaField label="Descripción larga" placeholder="Descripción clara y concisa de tu marca y canal." value={p.longDescription} onChange={(v) => setProfile({ ...p, longDescription: v })} />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <TextareaField label="Misión" value={p.mission} onChange={(v) => setProfile({ ...p, mission: v })} />
          <TextareaField label="Propuesta de valor" value={p.valueProposition} onChange={(v) => setProfile({ ...p, valueProposition: v })} />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <TextareaField label="Tono de comunicación" placeholder="Cercano, experto, concreto, pragmático." value={p.toneOfVoice} onChange={(v) => setProfile({ ...p, toneOfVoice: v })} />
          <TextareaField label="Personalidad" placeholder="Operador estratégico, sin fluff." value={p.personality} onChange={(v) => setProfile({ ...p, personality: v })} />
          <TagField label="Mercados objetivo" value={p.targetMarkets} onChange={(v) => setProfile({ ...p, targetMarkets: v })} placeholder="belleza, salud, estética" />
        </div>
      </section>

      {/* Persona & growth goals */}
      <section className={sectionCls}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white/90">Perfil personal y objetivos de crecimiento</h2>
          <span className="text-xs text-white/30">Ayuda a la IA a calibrar tono y a medir tu progreso.</span>
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <SelectField
            label="Rango de edad"
            value={p.ageRange}
            onChange={(v) => setProfile({ ...p, ageRange: v })}
            options={[
              { value: "18-25", label: "18-25" },
              { value: "25-35", label: "25-35" },
              { value: "35-45", label: "35-45" },
              { value: "45+", label: "45+" },
            ]}
          />
          <SelectField
            label="Sexo"
            value={p.gender}
            onChange={(v) => setProfile({ ...p, gender: v })}
            options={[
              { value: "male", label: "Hombre" },
              { value: "female", label: "Mujer" },
              { value: "non_binary", label: "No binario" },
              { value: "prefer_not_to_say", label: "Prefiero no decirlo" },
            ]}
          />
          <SelectField
            label="Estilo visual predominante"
            value={p.contentStyle}
            onChange={(v) => setProfile({ ...p, contentStyle: v })}
            options={[
              { value: "minimalista", label: "Minimalista" },
              { value: "colorido", label: "Colorido" },
              { value: "profesional", label: "Profesional" },
              { value: "casual", label: "Casual" },
              { value: "lifestyle", label: "Lifestyle" },
            ]}
          />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <Field
            label="Objetivo de seguidores"
            value={p.growthGoalFollowers ?? ""}
            onChange={(v) => setProfile({ ...p, growthGoalFollowers: v ? Number(v) : null })}
          />
          <Field
            label="Plazo del objetivo"
            placeholder="6 meses"
            value={p.growthGoalTimeline}
            onChange={(v) => setProfile({ ...p, growthGoalTimeline: v })}
          />
          <Field
            label="Frecuencia real de publicación (posts/semana)"
            value={p.postingFrequency ?? ""}
            onChange={(v) => setProfile({ ...p, postingFrequency: v ? Number(v) : null })}
          />
        </div>
      </section>

      {/* Niche & topics */}
      <section className={sectionCls}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white/90">Nicho y temas</h2>
          <span className="text-xs text-white/30">De qué habla tu canal y qué evita.</span>
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <Field label="Nicho principal" value={p.niche} onChange={(v) => setProfile({ ...p, niche: v })} />
          <TagField label="Subnichos" value={p.subniches} onChange={(v) => setProfile({ ...p, subniches: v })} placeholder="clínicas estéticas, salones de pelo" />
          <TagField label="Temas principales" value={p.mainTopics} onChange={(v) => setProfile({ ...p, mainTopics: v })} placeholder="captación de clientes, retención, automatización" />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <TagField label="Temas secundarios" value={p.secondaryTopics} onChange={(v) => setProfile({ ...p, secondaryTopics: v })} />
          <TagField label="Temas virales" value={p.viralThemes} onChange={(v) => setProfile({ ...p, viralThemes: v })} />
          <TagField label="Temas tendencia" value={p.trendingTopics} onChange={(v) => setProfile({ ...p, trendingTopics: v })} />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <TagField label="Temas estacionales" value={p.seasonalTopics} onChange={(v) => setProfile({ ...p, seasonalTopics: v })} />
          <TagField label="Temas prohibidos" value={p.forbiddenTopics} onChange={(v) => setProfile({ ...p, forbiddenTopics: v })} />
          <TagField label="Temas permitidos" value={p.allowedTopics} onChange={(v) => setProfile({ ...p, allowedTopics: v })} />
        </div>
      </section>

      {/* Audience */}
      <section className={sectionCls}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white/90">Audiencia</h2>
          <span className="text-xs text-white/30">A quién hablas y qué les importa.</span>
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <TextareaField label="Descripción de audiencia" value={p.audienceDescription} onChange={(v) => setProfile({ ...p, audienceDescription: v })} />
          <TextareaField label="Buyer persona" value={p.buyerPersona} onChange={(v) => setProfile({ ...p, buyerPersona: v })} />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <TagField label="Pain points" value={p.painPoints} onChange={(v) => setProfile({ ...p, painPoints: v })} />
          <TagField label="Deseos" value={p.desires} onChange={(v) => setProfile({ ...p, desires: v })} />
          <TagField label="Objeciones" value={p.objections} onChange={(v) => setProfile({ ...p, objections: v })} />
        </div>
      </section>

      {/* Business & offers */}
      <section className={sectionCls}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white/90">Negocio y ofertas</h2>
          <span className="text-xs text-white/30">Cómo ganas dinero realmente.</span>
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <TagField label="Productos" value={p.products} onChange={(v) => setProfile({ ...p, products: v })} />
          <TagField label="Servicios" value={p.services} onChange={(v) => setProfile({ ...p, services: v })} />
          <TagField label="Ofertas" value={p.offers} onChange={(v) => setProfile({ ...p, offers: v })} />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <Field label="Precio promedio (opcional)" value={p.avgPrice ?? ""} onChange={(v) => setProfile({ ...p, avgPrice: v ? Number(v) : null })} />
          <TagField label="Transformaciones" value={p.transformations} onChange={(v) => setProfile({ ...p, transformations: v })} />
          <TagField label="Diferenciadores" value={p.differentiators} onChange={(v) => setProfile({ ...p, differentiators: v })} />
        </div>
      </section>

      {/* Keywords & hashtags */}
      <section className={sectionCls}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white/90">Keywords y hashtags</h2>
          <span className="text-xs text-white/30">Por qué quieres rankear y ser encontrado.</span>
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <TagField label="Keywords base" value={p.baseKeywords} onChange={(v) => setProfile({ ...p, baseKeywords: v })} />
          <TagField label="Keywords prioritarias" value={p.priorityKeywords} onChange={(v) => setProfile({ ...p, priorityKeywords: v })} />
          <TagField label="Keywords long-tail" value={p.longTailKeywords} onChange={(v) => setProfile({ ...p, longTailKeywords: v })} />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <TagField label="Hashtags base" value={p.baseHashtags} onChange={(v) => setProfile({ ...p, baseHashtags: v })} />
          <TagField label="Hashtags prioritarios" value={p.priorityHashtags} onChange={(v) => setProfile({ ...p, priorityHashtags: v })} />
          <TagField label="Hashtags de competidores" value={p.competitorHashtags} onChange={(v) => setProfile({ ...p, competitorHashtags: v })} />
        </div>
      </section>

      {/* Competitors */}
      <section className={sectionCls}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white/90">Competidores</h2>
          <span className="text-xs text-white/30">De quién aprendes y con quién te diferencias.</span>
        </div>
        <div className="space-y-3 text-sm">
          {competitors.length === 0 && (
            <p className="text-xs text-white/30">
              Sin competidores añadidos. Puedes generar campañas IA igualmente, pero el análisis será genérico.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {competitors.map((c) => (
              <div key={c.id} className="flex flex-col gap-1 rounded-lg border border-white/8 bg-white/4 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white/85">{c.name}</span>
                  <span className="text-xs uppercase text-white/35">{c.platform}</span>
                </div>
                <p className="text-xs text-white/45">Handle: {c.handle || "-"}</p>
                <p className="text-xs text-white/45">Nicho: {c.niche || "-"}</p>
                <p className="text-xs text-white/45">Fortalezas: {c.strengths?.join(", ")}</p>
                <p className="text-xs text-white/45">Oportunidades: {c.differentiationOpportunities?.join(", ")}</p>
                {Array.isArray(c.patterns) && c.patterns.length > 0 && (
                  <p className="text-xs text-white/45">Patrones: {c.patterns.join(", ")}</p>
                )}
                {Array.isArray(c.winningFormats) && c.winningFormats.length > 0 && (
                  <p className="text-xs text-white/45">Formatos ganadores: {c.winningFormats.join(", ")}</p>
                )}
                {Array.isArray(c.hookStyles) && c.hookStyles.length > 0 && (
                  <p className="text-xs text-white/45">Estilos de hook: {c.hookStyles.join(" | ")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Channel intelligence */}
      <section className={sectionCls}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white/90">Inteligencia del canal</h2>
          <span className="text-xs text-white/30">Snapshot de cómo la IA ve tu mercado.</span>
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white/70">Señales de tendencia y mercado</h3>
            <p className="text-xs text-white/30">Estas señales guían al TrendAgent y al KeywordAgent.</p>
            <div className="grid gap-2 md:grid-cols-2">
              <MiniList title="Temas virales" items={p.viralThemes} />
              <MiniList title="Temas tendencia" items={p.trendingTopics} />
              <MiniList title="Señales de mercado" items={p.marketSignals} />
              <MiniList title="Señales de oportunidad" items={p.opportunitySignals} />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-white/70">Keywords y hashtags (motor IA)</h3>
            <p className="text-xs text-white/30">
              Datos base para el motor de keywords. Los clústeres se calculan al correr el pipeline IA.
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              <MiniList title="Keywords base" items={p.baseKeywords} />
              <MiniList title="Keywords prioritarias" items={p.priorityKeywords} />
              <MiniList title="Hashtags base" items={p.baseHashtags} />
              <MiniList title="Hashtags prioritarios" items={p.priorityHashtags} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
