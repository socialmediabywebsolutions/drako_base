"use client";

import { useEffect, useState } from "react";

type ProfileResponse = {
  ok: boolean;
  profile?: Record<string, unknown>;
  competitors?: unknown[];
  error?: string;
};

export default function SocialFlowProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown>>({});
  const [competitorCount, setCompetitorCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/socialflow/profile");
        const payload = (await response.json().catch(() => null)) as ProfileResponse | null;
        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error ?? "Failed to load profile.");
        }

        if (!cancelled) {
          setProfile(payload.profile ?? {});
          setCompetitorCount(payload.competitors?.length ?? 0);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load profile.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile() {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/socialflow/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const payload = (await response.json().catch(() => null)) as ProfileResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error ?? "Failed to save profile.");
      }
      setProfile((payload.profile ?? profile) as Record<string, unknown>);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Loading SocialFlow profile...</div>;
  }

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">SocialFlow profile</div>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Channel knowledge inside the new runtime</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          This page reads and updates the SocialFlow channel profile through the ported `GET/POST /api/socialflow/profile`
          handlers. Competitors remain read-only here for now.
        </p>
        <div className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-400">
          competitors loaded {competitorCount}
        </div>
      </section>

      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="grid gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Brand name</label>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 shadow-sm"
            value={String(profile.brandName ?? "")}
            onChange={(event) => setProfile((current) => ({ ...current, brandName: event.target.value }))}
          />

          <label className="mt-5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Channel handle</label>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 shadow-sm"
            value={String(profile.channelName ?? "")}
            onChange={(event) => setProfile((current) => ({ ...current, channelName: event.target.value }))}
          />

          <label className="mt-5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Primary niche</label>
          <input
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 shadow-sm"
            value={String(profile.niche ?? "")}
            onChange={(event) => setProfile((current) => ({ ...current, niche: event.target.value }))}
          />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Tone of voice</label>
          <textarea
            className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 shadow-sm"
            value={String(profile.toneOfVoice ?? "")}
            onChange={(event) => setProfile((current) => ({ ...current, toneOfVoice: event.target.value }))}
          />

          <label className="mt-5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Short description</label>
          <textarea
            className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-950 shadow-sm"
            value={String(profile.shortDescription ?? "")}
            onChange={(event) => setProfile((current) => ({ ...current, shortDescription: event.target.value }))}
          />
        </div>
      </section>

      <button
        type="button"
        onClick={saveProfile}
        disabled={saving}
        className="inline-flex rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
      >
        {saving ? "Saving profile..." : "Save profile"}
      </button>
    </div>
  );
}
