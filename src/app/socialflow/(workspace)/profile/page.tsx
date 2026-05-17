"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/socialflow/profile");
        const json: ProfileResponse = await res.json();
        if (!json.ok) {
          if (!cancelled) setError(json.error || "Failed to load profile");
        } else {
          if (!cancelled) {
            setProfile(json.profile || null);
            setCompetitors(json.competitors || []);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Unexpected error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSaveProfile() {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/socialflow/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const json: ProfileResponse = await res.json();
      if (!json.ok) {
        setError(json.error || "Failed to save profile");
      } else {
        setProfile(json.profile || profile);
      }
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !profile) {
    return <div className="p-6 text-sm text-gray-600">Loading channel knowledge base...</div>;
  }

  if (error && !profile) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  const p = profile || {};

  return (
    <div className="space-y-8">
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">SocialFlow Channel Profile</h1>
        <p className="mb-4 text-sm text-gray-600">
          This profile trains the SocialFlow AI agents. Fill it with real, strategic information about your brand, audience
          and offers. The AI strategy and content pipeline will use this as its primary knowledge base.
        </p>

        <button
          type="button"
          onClick={onSaveProfile}
          disabled={saving}
          className="inline-flex items-center rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save channel profile"}
        </button>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <section className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Brand identity</h2>
          <span className="text-xs text-gray-500">Who you are and how you sound.</span>
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <Field label="Brand name" value={p.brandName} onChange={(v) => setProfile({ ...p, brandName: v })} />
          <Field label="Channel handle" value={p.channelName} onChange={(v) => setProfile({ ...p, channelName: v })} />
          <Field
            label="Primary language"
            value={p.primaryLanguage}
            onChange={(v) => setProfile({ ...p, primaryLanguage: v })}
          />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <TextareaField
            label="Short description"
            placeholder="One sentence that explains what this channel is about."
            value={p.shortDescription}
            onChange={(v) => setProfile({ ...p, shortDescription: v })}
          />
          <TextareaField
            label="Long description"
            placeholder="A clear, concise description of your brand and channel."
            value={p.longDescription}
            onChange={(v) => setProfile({ ...p, longDescription: v })}
          />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <TextareaField label="Mission" value={p.mission} onChange={(v) => setProfile({ ...p, mission: v })} />
          <TextareaField
            label="Value proposition"
            value={p.valueProposition}
            onChange={(v) => setProfile({ ...p, valueProposition: v })}
          />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <TextareaField
            label="Tone of voice"
            placeholder="e.g. Friendly, expert, concrete, pragmatic."
            value={p.toneOfVoice}
            onChange={(v) => setProfile({ ...p, toneOfVoice: v })}
          />
          <TextareaField
            label="Personality"
            placeholder="e.g. Strategic operator, no fluff."
            value={p.personality}
            onChange={(v) => setProfile({ ...p, personality: v })}
          />
          <TagField
            label="Target markets"
            value={p.targetMarkets}
            onChange={(v) => setProfile({ ...p, targetMarkets: v })}
            placeholder="beauty, health, aesthetics"
          />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Niche & topics</h2>
          <span className="text-xs text-gray-500">What your channel talks about, and what it avoids.</span>
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <Field label="Primary niche" value={p.niche} onChange={(v) => setProfile({ ...p, niche: v })} />
          <TagField
            label="Subniches"
            value={p.subniches}
            onChange={(v) => setProfile({ ...p, subniches: v })}
            placeholder="aesthetic clinics, hair salons"
          />
          <TagField
            label="Main topics"
            value={p.mainTopics}
            onChange={(v) => setProfile({ ...p, mainTopics: v })}
            placeholder="client acquisition, retention, automation"
          />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <TagField
            label="Secondary topics"
            value={p.secondaryTopics}
            onChange={(v) => setProfile({ ...p, secondaryTopics: v })}
          />
          <TagField label="Viral themes" value={p.viralThemes} onChange={(v) => setProfile({ ...p, viralThemes: v })} />
          <TagField
            label="Trending topics"
            value={p.trendingTopics}
            onChange={(v) => setProfile({ ...p, trendingTopics: v })}
          />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <TagField
            label="Seasonal topics"
            value={p.seasonalTopics}
            onChange={(v) => setProfile({ ...p, seasonalTopics: v })}
          />
          <TagField
            label="Forbidden topics"
            value={p.forbiddenTopics}
            onChange={(v) => setProfile({ ...p, forbiddenTopics: v })}
          />
          <TagField
            label="Allowed topics"
            value={p.allowedTopics}
            onChange={(v) => setProfile({ ...p, allowedTopics: v })}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Audience</h2>
          <span className="text-xs text-gray-500">Who you are speaking to and what they care about.</span>
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <TextareaField
            label="Audience description"
            value={p.audienceDescription}
            onChange={(v) => setProfile({ ...p, audienceDescription: v })}
          />
          <TextareaField
            label="Buyer persona"
            value={p.buyerPersona}
            onChange={(v) => setProfile({ ...p, buyerPersona: v })}
          />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <TagField label="Pain points" value={p.painPoints} onChange={(v) => setProfile({ ...p, painPoints: v })} />
          <TagField label="Desires" value={p.desires} onChange={(v) => setProfile({ ...p, desires: v })} />
          <TagField label="Objections" value={p.objections} onChange={(v) => setProfile({ ...p, objections: v })} />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Business & offers</h2>
          <span className="text-xs text-gray-500">How you actually make money.</span>
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <TagField label="Products" value={p.products} onChange={(v) => setProfile({ ...p, products: v })} />
          <TagField label="Services" value={p.services} onChange={(v) => setProfile({ ...p, services: v })} />
          <TagField label="Offers" value={p.offers} onChange={(v) => setProfile({ ...p, offers: v })} />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <Field
            label="Average price (optional)"
            value={p.avgPrice ?? ""}
            onChange={(v) => setProfile({ ...p, avgPrice: v ? Number(v) : null })}
          />
          <TagField
            label="Transformations"
            value={p.transformations}
            onChange={(v) => setProfile({ ...p, transformations: v })}
          />
          <TagField
            label="Differentiators"
            value={p.differentiators}
            onChange={(v) => setProfile({ ...p, differentiators: v })}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Keywords & hashtags</h2>
          <span className="text-xs text-gray-500">What you want to rank and be found for.</span>
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <TagField label="Base keywords" value={p.baseKeywords} onChange={(v) => setProfile({ ...p, baseKeywords: v })} />
          <TagField
            label="Priority keywords"
            value={p.priorityKeywords}
            onChange={(v) => setProfile({ ...p, priorityKeywords: v })}
          />
          <TagField
            label="Long-tail keywords"
            value={p.longTailKeywords}
            onChange={(v) => setProfile({ ...p, longTailKeywords: v })}
          />
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-3">
          <TagField label="Base hashtags" value={p.baseHashtags} onChange={(v) => setProfile({ ...p, baseHashtags: v })} />
          <TagField
            label="Priority hashtags"
            value={p.priorityHashtags}
            onChange={(v) => setProfile({ ...p, priorityHashtags: v })}
          />
          <TagField
            label="Competitor hashtags"
            value={p.competitorHashtags}
            onChange={(v) => setProfile({ ...p, competitorHashtags: v })}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Competitors</h2>
          <span className="text-xs text-gray-500">Who you learn from and differentiate against.</span>
        </div>
        <div className="space-y-3 text-sm">
          {competitors.length === 0 && (
            <p className="text-xs text-gray-500">
              No competitors added yet. You can still generate AI campaigns, but analysis will be generic.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {competitors.map((c) => (
              <div key={c.id} className="flex flex-col gap-1 rounded border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-xs uppercase text-gray-500">{c.platform}</span>
                </div>
                <p className="text-xs text-gray-600">Handle: {c.handle || "-"}</p>
                <p className="text-xs text-gray-600">Niche: {c.niche || "-"}</p>
                <p className="text-xs text-gray-600">Strengths: {c.strengths?.join(", ")}</p>
                <p className="text-xs text-gray-600">Opportunities: {c.differentiationOpportunities?.join(", ")}</p>
                {Array.isArray(c.patterns) && c.patterns.length > 0 && (
                  <p className="text-xs text-gray-600">Patterns: {c.patterns.join(", ")}</p>
                )}
                {Array.isArray(c.winningFormats) && c.winningFormats.length > 0 && (
                  <p className="text-xs text-gray-600">Winning formats: {c.winningFormats.join(", ")}</p>
                )}
                {Array.isArray(c.hookStyles) && c.hookStyles.length > 0 && (
                  <p className="text-xs text-gray-600">Hook styles: {c.hookStyles.join(" | ")}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Channel intelligence</h2>
          <span className="text-xs text-gray-500">Snapshot of how the AI sees your market.</span>
        </div>
        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Trend & market signals</h3>
            <p className="text-xs text-gray-500">These signals guide the TrendAgent and KeywordAgent.</p>
            <div className="grid gap-2 md:grid-cols-2">
              <MiniList title="Viral themes" items={p.viralThemes} />
              <MiniList title="Trending topics" items={p.trendingTopics} />
              <MiniList title="Market signals" items={p.marketSignals} />
              <MiniList title="Opportunity signals" items={p.opportunitySignals} />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Keywords & hashtags (AI engine)</h3>
            <p className="text-xs text-gray-500">
              Base data for the keyword engine. Clusters are computed when you run the AI pipeline.
            </p>
            <div className="grid gap-2 md:grid-cols-2">
              <MiniList title="Base keywords" items={p.baseKeywords} />
              <MiniList title="Priority keywords" items={p.priorityKeywords} />
              <MiniList title="Base hashtags" items={p.baseHashtags} />
              <MiniList title="Priority hashtags" items={p.priorityHashtags} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field(props: { label: string; value: any; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{props.label}</span>
      <input className="rounded border px-3 py-2 text-sm" value={props.value ?? ""} onChange={(e) => props.onChange(e.target.value)} />
    </label>
  );
}

function MiniList(props: { title: string; items: string[] | undefined }) {
  const items = props.items ?? [];
  if (!items.length) {
    return null;
  }
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold text-gray-700">{props.title}</h4>
      <ul className="list-disc space-y-0.5 pl-4 text-xs text-gray-600">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function TextareaField(props: { label: string; value: any; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{props.label}</span>
      <textarea
        className="min-h-[80px] rounded border px-3 py-2 text-sm"
        placeholder={props.placeholder}
        value={props.value ?? ""}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

function TagField(props: {
  label: string;
  value: string[] | undefined;
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const value = props.value ?? [];
  const joined = value.join(", ");
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{props.label}</span>
      <input
        className="rounded border px-3 py-2 text-sm"
        placeholder={props.placeholder}
        value={joined}
        onChange={(e) => props.onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
      />
    </label>
  );
}
