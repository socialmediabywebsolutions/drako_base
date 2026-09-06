"use client";

import { useEffect, useState } from "react";
import { Field, MiniList, SelectField, sectionCls, TagField, TextareaField } from "./ProfileFormFields";
import ProfileAiChat from "./ProfileAiChat";
import PhysicalProfileAiChat from "./PhysicalProfileAiChat";
import EmployeeTeamSection from "./EmployeeTeamSection";

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
  const [accountType, setAccountType] = useState<"influencer" | "empresa" | null>(null);
  const [physicalProfile, setPhysicalProfile] = useState<any>({});
  const [physicalSaving, setPhysicalSaving] = useState(false);
  const [physicalError, setPhysicalError] = useState<string | null>(null);
  const [faceUploading, setFaceUploading] = useState(false);
  const [physicalChatOpen, setPhysicalChatOpen] = useState(false);

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
    async function loadAccountType() {
      try {
        const res = await fetch("/api/socialflow/onboarding");
        const json: any = await res.json();
        if (!cancelled && json.ok) setAccountType(json.accountType ?? null);
      } catch {
        // best-effort — la sección de perfil físico simplemente no se mostrará
      }
    }
    async function loadPhysicalProfile() {
      try {
        const res = await fetch("/api/socialflow/profile/physical");
        const json: any = await res.json();
        if (!cancelled && json.ok && json.profile) setPhysicalProfile(json.profile);
      } catch {
        // best-effort
      }
    }
    void load();
    void loadAccountType();
    void loadPhysicalProfile();
    return () => { cancelled = true; };
  }, []);

  async function onSavePhysicalProfile() {
    setPhysicalSaving(true);
    setPhysicalError(null);
    try {
      const res = await fetch("/api/socialflow/profile/physical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(physicalProfile),
      });
      const json: any = await res.json();
      if (!json.ok) {
        setPhysicalError(json.error || "No se pudo guardar el perfil físico");
      } else {
        setPhysicalProfile(json.profile || physicalProfile);
      }
    } catch (e: any) {
      setPhysicalError(e?.message || "Error inesperado");
    } finally {
      setPhysicalSaving(false);
    }
  }

  async function onUploadFacePhoto(file: File) {
    setFaceUploading(true);
    setPhysicalError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/socialflow/profile/physical/face", { method: "POST", body: formData });
      const json: any = await res.json();
      if (!json.ok) {
        setPhysicalError(json.message || json.error || "No se pudo subir la foto");
        return;
      }
      const updated = { ...physicalProfile, referenceImageUrl: json.url, referenceFaceR2Key: json.key };
      setPhysicalProfile(updated);
      const saveRes = await fetch("/api/socialflow/profile/physical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      const saveJson: any = await saveRes.json();
      if (saveJson.ok) setPhysicalProfile(saveJson.profile || updated);
    } catch (e: any) {
      setPhysicalError(e?.message || "Error inesperado al subir la foto");
    } finally {
      setFaceUploading(false);
    }
  }

  async function onPhysicalFieldsExtracted(fields: Record<string, unknown>) {
    const updated = { ...physicalProfile, ...fields };
    setPhysicalProfile(updated);
    try {
      const res = await fetch("/api/socialflow/profile/physical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      const json: any = await res.json();
      if (json.ok) setPhysicalProfile(json.profile || updated);
    } catch {
      // best-effort — el chat sigue avanzando aunque un guardado puntual falle
    }
  }

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
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">Socialcors · Perfil</div>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-white">Perfil del canal</h1>
        <p className="mb-5 mt-2 text-sm text-white/45">
          Este perfil entrena a los agentes IA de Socialcors. Rellénalo con información real y estratégica sobre tu marca, audiencia y ofertas. La IA usará esto como su base de conocimiento principal.
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
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <SelectField
            label="Objetivo principal del contenido"
            value={p.clientObjective}
            onChange={(v) => setProfile({ ...p, clientObjective: v })}
            options={[
              { value: "followers", label: "Ganar seguidores" },
              { value: "engagement", label: "Generar interacción" },
              { value: "leads", label: "Conseguir leads / DMs" },
              { value: "sales", label: "Vender (link en bio)" },
              { value: "saves", label: "Que guarden el contenido" },
            ]}
          />
        </div>
      </section>

      {/* Physical profile — only for influencer accounts, feeds the AI image generator */}
      {accountType === "influencer" && (() => {
        const heightM = physicalProfile.heightCm ? physicalProfile.heightCm / 100 : null;
        const bmi = heightM && physicalProfile.weightKg ? Math.round((physicalProfile.weightKg / (heightM * heightM)) * 10) / 10 : null;
        const bmiCategory =
          bmi == null ? null : bmi < 18.5 ? "Muy delgado" : bmi < 25 ? "Normal" : bmi < 30 ? "Con curvas" : "Voluminoso";
        const showChestCup = physicalProfile.gender === "mujer" || physicalProfile.gender === "no_binario";
        const showBeard = physicalProfile.gender === "hombre";
        const visualStyles: string[] = physicalProfile.contentVisualStyle ?? [];
        const fitnessStyles: string[] = physicalProfile.fitnessStyles ?? [];

        return (
          <section className={sectionCls}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white/90">Perfil físico</h2>
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/30">Guía a la IA para generar imágenes que se parezcan a ti.</span>
                <button
                  type="button"
                  onClick={() => setPhysicalChatOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20"
                >
                  ✨ Rellenar con IA
                </button>
              </div>
            </div>

            {physicalChatOpen && (
              <PhysicalProfileAiChat onClose={() => setPhysicalChatOpen(false)} onFieldsExtracted={onPhysicalFieldsExtracted} />
            )}

            {/* BLOQUE A — Identidad y género */}
            <div className="grid gap-4 text-sm md:grid-cols-3">
              <SelectField
                label="Género"
                value={physicalProfile.gender}
                onChange={(v) => setPhysicalProfile({ ...physicalProfile, gender: v })}
                options={[
                  { value: "mujer", label: "Mujer" },
                  { value: "hombre", label: "Hombre" },
                  { value: "no_binario", label: "No binario" },
                  { value: "prefiero_no_decir", label: "Prefiero no decirlo" },
                ]}
              />
            </div>

            {/* BLOQUE B — Medidas corporales */}
            <div className="grid gap-4 text-sm md:grid-cols-3">
              <Field
                label="Altura (cm)"
                value={physicalProfile.heightCm ?? ""}
                onChange={(v) => setPhysicalProfile({ ...physicalProfile, heightCm: v ? Number(v) : null })}
              />
              <Field
                label="Peso (kg)"
                value={physicalProfile.weightKg ?? ""}
                onChange={(v) => setPhysicalProfile({ ...physicalProfile, weightKg: v ? Number(v) : null })}
              />
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium text-white/45">IMC (calculado)</span>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
                  {bmi != null ? `${bmi} — ${bmiCategory}` : "Introduce altura y peso"}
                </div>
              </div>
            </div>
            <div className="grid gap-4 text-sm md:grid-cols-3">
              <SelectField
                label="Constitución corporal"
                value={physicalProfile.bodyConstitution}
                onChange={(v) => setPhysicalProfile({ ...physicalProfile, bodyConstitution: v })}
                options={[
                  { value: "ectomorfo", label: "Ectomorfo (delgado natural)" },
                  { value: "mesomorfo", label: "Mesomorfo (atlético natural)" },
                  { value: "endomorfo", label: "Endomorfo (tendencia a ganar peso)" },
                  { value: "mixto", label: "Mixto" },
                ]}
              />
              <Field
                label="Cintura (cm)"
                value={physicalProfile.waistCm ?? ""}
                onChange={(v) => setPhysicalProfile({ ...physicalProfile, waistCm: v ? Number(v) : null })}
              />
              <Field
                label="Caderas (cm)"
                value={physicalProfile.hipsCm ?? ""}
                onChange={(v) => setPhysicalProfile({ ...physicalProfile, hipsCm: v ? Number(v) : null })}
              />
            </div>
            {showChestCup && (
              <div className="grid gap-4 text-sm md:grid-cols-3">
                <Field
                  label="Pecho (cm)"
                  value={physicalProfile.chestCm ?? ""}
                  onChange={(v) => setPhysicalProfile({ ...physicalProfile, chestCm: v ? Number(v) : null })}
                />
                <SelectField
                  label="Copa"
                  value={physicalProfile.cupSize}
                  onChange={(v) => setPhysicalProfile({ ...physicalProfile, cupSize: v })}
                  options={["AA", "A", "B", "C", "D", "DD", "E", "F"].map((v) => ({ value: v, label: v }))}
                />
              </div>
            )}

            {/* BLOQUE C — Complexión visual */}
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <SelectField
                label="Complexión"
                value={physicalProfile.bodyType}
                onChange={(v) => setPhysicalProfile({ ...physicalProfile, bodyType: v })}
                options={[
                  { value: "atletica", label: "Atlética" },
                  { value: "fibrada", label: "Fibrada" },
                  { value: "normal", label: "Normal" },
                  { value: "curvilinea", label: "Curvilínea" },
                  { value: "musculosa", label: "Musculosa" },
                ]}
              />
              <SelectField
                label="Tono de piel"
                value={physicalProfile.skinTone}
                onChange={(v) => setPhysicalProfile({ ...physicalProfile, skinTone: v })}
                options={[
                  { value: "muy_clara", label: "Muy clara" },
                  { value: "clara", label: "Clara" },
                  { value: "media", label: "Media" },
                  { value: "olivacea", label: "Olivácea" },
                  { value: "morena", label: "Morena" },
                  { value: "oscura", label: "Oscura" },
                  { value: "muy_oscura", label: "Muy oscura" },
                ]}
              />
            </div>

            {/* BLOQUE D — Cabello */}
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <SelectField
                label="Color base"
                value={physicalProfile.hairColorBase}
                onChange={(v) => setPhysicalProfile({ ...physicalProfile, hairColorBase: v })}
                options={[
                  { value: "negro", label: "Negro" },
                  { value: "castano_oscuro", label: "Castaño oscuro" },
                  { value: "castano", label: "Castaño" },
                  { value: "castano_claro", label: "Castaño claro" },
                  { value: "rubio_oscuro", label: "Rubio oscuro" },
                  { value: "rubio", label: "Rubio" },
                  { value: "rubio_platino", label: "Rubio platino" },
                  { value: "pelirrojo", label: "Pelirrojo" },
                  { value: "canoso", label: "Canoso" },
                  { value: "rapado_sin_cabello", label: "Rapado/Sin cabello" },
                ]}
              />
              <SelectField
                label="Estilo/tratamiento"
                value={physicalProfile.hairStyle}
                onChange={(v) => setPhysicalProfile({ ...physicalProfile, hairStyle: v })}
                options={[
                  { value: "sin_tratamiento", label: "Sin tratamiento" },
                  { value: "mechas_californianas", label: "Mechas californianas" },
                  { value: "mechas_babylights", label: "Mechas babylights" },
                  { value: "mechas_balayage", label: "Mechas balayage" },
                  { value: "mechas_de_color", label: "Mechas de color" },
                  { value: "ombre", label: "Ombré" },
                  { value: "highlights", label: "Highlights" },
                  { value: "tenido_fantasia", label: "Teñido fantasía" },
                ]}
              />
            </div>
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <SelectField
                label="Largo"
                value={physicalProfile.hairLength}
                onChange={(v) => setPhysicalProfile({ ...physicalProfile, hairLength: v })}
                options={[
                  { value: "rapado", label: "Rapado" },
                  { value: "muy_corto", label: "Muy corto" },
                  { value: "corto", label: "Corto" },
                  { value: "medio", label: "Medio" },
                  { value: "largo", label: "Largo" },
                  { value: "muy_largo", label: "Muy largo" },
                ]}
              />
              <SelectField
                label="Textura"
                value={physicalProfile.hairTexture}
                onChange={(v) => setPhysicalProfile({ ...physicalProfile, hairTexture: v })}
                options={[
                  { value: "liso", label: "Liso" },
                  { value: "ondulado", label: "Ondulado" },
                  { value: "rizado", label: "Rizado" },
                  { value: "muy_rizado", label: "Muy rizado/Afro" },
                ]}
              />
            </div>

            {/* BLOQUE E — Rasgos faciales */}
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <SelectField
                label="Forma de cara"
                value={physicalProfile.faceShape}
                onChange={(v) => setPhysicalProfile({ ...physicalProfile, faceShape: v })}
                options={[
                  { value: "ovalada", label: "Ovalada" },
                  { value: "redonda", label: "Redonda" },
                  { value: "cuadrada", label: "Cuadrada" },
                  { value: "corazon", label: "Corazón" },
                  { value: "alargada", label: "Alargada" },
                ]}
              />
              <SelectField
                label="Color de ojos"
                value={physicalProfile.eyeColor}
                onChange={(v) => setPhysicalProfile({ ...physicalProfile, eyeColor: v })}
                options={[
                  { value: "marrones", label: "Marrones" },
                  { value: "verdes", label: "Verdes" },
                  { value: "azules", label: "Azules" },
                  { value: "grises", label: "Grises" },
                  { value: "miel", label: "Miel" },
                  { value: "negros", label: "Negros" },
                  { value: "heterocromia", label: "Heterocromía" },
                ]}
              />
            </div>

            {/* BLOQUE F — Estilo visual de contenido */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-white/45">Estilo visual de contenido</span>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {[
                  { value: "minimalista", label: "Minimalista" },
                  { value: "colorido_vibrante", label: "Colorido/vibrante" },
                  { value: "oscuro_moody", label: "Oscuro/moody" },
                  { value: "natural_sin_filtros", label: "Natural/sin filtros" },
                  { value: "glamuroso", label: "Glamuroso" },
                  { value: "deportivo_raw", label: "Deportivo/raw" },
                  { value: "profesional_limpio", label: "Profesional/limpio" },
                ].map((opt) => {
                  const checked = visualStyles.includes(opt.value);
                  return (
                    <label key={opt.value} className="flex items-center gap-1.5 text-sm text-white/70">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setPhysicalProfile({
                            ...physicalProfile,
                            contentVisualStyle: e.target.checked
                              ? [...visualStyles, opt.value]
                              : visualStyles.filter((v) => v !== opt.value),
                          })
                        }
                        className="h-4 w-4 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500/40"
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* BLOQUE G — Detalles adicionales */}
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <SelectField
                label="Tatuajes"
                value={physicalProfile.tattoos}
                onChange={(v) => setPhysicalProfile({ ...physicalProfile, tattoos: v })}
                options={[
                  { value: "sin_tatuajes", label: "Sin tatuajes" },
                  { value: "pequenos_discretos", label: "Tatuajes pequeños discretos" },
                  { value: "brazo", label: "Tatuajes en brazo" },
                  { value: "espalda", label: "Tatuajes en espalda" },
                  { value: "cuello_manos", label: "Tatuajes en cuello/manos" },
                  { value: "muy_tatuado", label: "Muy tatuado" },
                ]}
              />
              {showBeard && (
                <SelectField
                  label="Barba"
                  value={physicalProfile.beard}
                  onChange={(v) => setPhysicalProfile({ ...physicalProfile, beard: v })}
                  options={[
                    { value: "sin_barba", label: "Sin barba" },
                    { value: "corta", label: "Barba corta" },
                    { value: "larga", label: "Barba larga" },
                    { value: "bigote", label: "Bigote" },
                  ]}
                />
              )}
            </div>

            {/* BLOQUE H — Foto de rostro de referencia */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-white/45">
                Foto de rostro de referencia — la IA usará esta imagen para mantener consistencia facial en las imágenes generadas
              </span>
              <div className="flex items-center gap-3">
                {physicalProfile.referenceImageUrl && (
                  <img
                    src={physicalProfile.referenceImageUrl}
                    alt="Foto de rostro de referencia"
                    className="h-16 w-16 rounded-lg border border-white/10 object-cover"
                  />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  disabled={faceUploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void onUploadFacePhoto(file);
                  }}
                  className="text-xs text-white/50 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-500/20 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-violet-200 hover:file:bg-violet-500/30"
                />
                {faceUploading && <span className="text-xs text-white/40">Subiendo...</span>}
              </div>
            </div>

            {/* BLOQUE I — Estilos fitness */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-white/45">Estilo fitness</span>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {[
                  { value: "fitness", label: "Fitness" },
                  { value: "lifestyle", label: "Lifestyle" },
                  { value: "gym", label: "Gym" },
                  { value: "fitness_model", label: "Fitness Model" },
                  { value: "crossfit", label: "Crossfit" },
                  { value: "yoga", label: "Yoga" },
                  { value: "pilates", label: "Pilates" },
                  { value: "running", label: "Running" },
                  { value: "nutricion", label: "Nutrición" },
                  { value: "wellness", label: "Wellness" },
                ].map((opt) => {
                  const checked = fitnessStyles.includes(opt.value);
                  return (
                    <label key={opt.value} className="flex items-center gap-1.5 text-sm text-white/70">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setPhysicalProfile({
                            ...physicalProfile,
                            fitnessStyles: e.target.checked
                              ? [...fitnessStyles, opt.value]
                              : fitnessStyles.filter((v) => v !== opt.value),
                          })
                        }
                        className="h-4 w-4 rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500/40"
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            </div>

            {physicalError && <p className="text-sm text-red-300">{physicalError}</p>}
            <button
              type="button"
              onClick={() => onSavePhysicalProfile()}
              disabled={physicalSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {physicalSaving && <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
              {physicalSaving ? "Guardando..." : "Guardar perfil físico"}
            </button>
          </section>
        );
      })()}

      {/* Employee team — only for empresa accounts, feeds the AI image generator */}
      {accountType === "empresa" && <EmployeeTeamSection />}

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
        {/* "Temas estacionales" ya no es editable a mano aquí — lo gestiona
            SeasonalityAgent (contexto global por nicho+mes, ver BrandProfile.seasonalContext
            en src/lib/socialflow/ai/types.ts). El campo p.seasonalTopics se mantiene en el
            tipo de perfil por compatibilidad, pero ya no tiene UI de edición. */}
        <div className="grid gap-4 text-sm md:grid-cols-3">
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
