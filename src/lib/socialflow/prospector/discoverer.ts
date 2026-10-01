/**
 * ProspectorAgent — Descubre negocios potenciales para contactar
 *
 * Estrategia por capas (sin coste adicional):
 *   1. Google Maps Places API → datos reales (si GOOGLE_MAPS_API_KEY está configurada)
 *   2. Mistral AI → genera perfiles realistas del sector (fallback gratuito)
 *
 * Cada prospecto se enriquece con su Instagram handle si está disponible
 * y una descripción generada para personalizar el outreach.
 */

import { env } from "@/lib/cf";
import type { SocialFlowProspect, ProspectSource } from "./types";

type RawProspect = Omit<SocialFlowProspect, "id" | "status" | "outreachCount" | "lastOutreachAt" | "createdAt" | "updatedAt">;

// ─── Google Maps Places API ───────────────────────────────────────────────────

type GooglePlace = {
  place_id: string;
  name: string;
  formatted_address?: string;
  website?: string;
  international_phone_number?: string;
  rating?: number;
  user_ratings_total?: number;
};

async function discoverViaGoogleMaps(
  niche: string,
  location: string,
  apiKey: string,
  tenantId: string,
  saasId: string,
  campaignId: string | null
): Promise<RawProspect[]> {
  const query = encodeURIComponent(`${niche} ${location}`);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&language=es&key=${apiKey}`;

  const res = await fetch(url, { headers: { "User-Agent": "Socialcors/1.0" } });
  if (!res.ok) return [];

  const data = (await res.json()) as { status: string; results?: GooglePlace[] };
  if (data.status !== "OK" || !data.results?.length) return [];

  // Detalles de cada lugar (website, phone)
  const prospects: RawProspect[] = [];
  for (const place of data.results.slice(0, 20)) {
    const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,website,international_phone_number,rating,user_ratings_total,formatted_address&key=${apiKey}`;
    let website: string | null = null;
    let phone: string | null = null;
    let rating = place.rating ?? null;
    let reviewCount = place.user_ratings_total ?? null;
    let address = place.formatted_address ?? location;

    try {
      const detailRes = await fetch(detailUrl);
      if (detailRes.ok) {
        const detailData = (await detailRes.json()) as { result?: GooglePlace };
        website = detailData.result?.website ?? null;
        phone = detailData.result?.international_phone_number ?? null;
        rating = detailData.result?.rating ?? rating;
        reviewCount = detailData.result?.user_ratings_total ?? reviewCount;
        address = detailData.result?.formatted_address ?? address;
      }
    } catch { /* ignora errores de detail */ }

    prospects.push({
      tenantId, saasId, campaignId,
      businessName: place.name,
      contactName: null,
      email: null,
      phone,
      whatsapp: phone,
      website,
      instagramHandle: null,
      niche,
      location: address,
      description: `${place.name} — ${niche} en ${location}`,
      source: "GOOGLE_MAPS" as ProspectSource,
      rating,
      reviewCount,
      notes: null,
    });
  }

  return prospects;
}

// ─── Mistral AI Fallback ──────────────────────────────────────────────────────

type MistralProspectProfile = {
  businessName: string;
  contactName: string | null;
  instagramHandle: string | null;
  website: string | null;
  description: string;
  location: string;
};

async function discoverViaMistral(
  niche: string,
  location: string,
  tenantId: string,
  saasId: string,
  campaignId: string | null
): Promise<RawProspect[]> {
  const bindings = env() as Record<string, unknown> | null;
  const aiBinding = bindings?.AI as { run: (model: string, opts: unknown) => Promise<unknown> } | null;
  if (!aiBinding) return [];

  const prompt = `Eres un experto en marketing digital. Genera una lista de 15 negocios reales y representativos del sector "${niche}" en "${location}" que podrían beneficiarse de automatizar sus redes sociales.

Para cada negocio devuelve un JSON array con este formato exacto:
[
  {
    "businessName": "Nombre del negocio",
    "contactName": "Nombre del responsable o null",
    "instagramHandle": "@handle_instagram o null",
    "website": "https://... o null",
    "description": "Descripción de 1 frase del negocio y por qué necesita redes sociales profesionales",
    "location": "${location}"
  }
]

Responde SOLO con el JSON, sin texto adicional. Que sean negocios plausibles y variados.`;

  const result = await aiBinding.run("@cf/mistral/mistral-7b-instruct-v0.1", {
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2000,
    temperature: 0.7,
  }) as { response?: string };

  let profiles: MistralProspectProfile[] = [];
  try {
    const raw = result.response ?? "";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (jsonMatch) profiles = JSON.parse(jsonMatch[0]) as MistralProspectProfile[];
  } catch { return []; }

  return profiles.map((p) => ({
    tenantId, saasId, campaignId,
    businessName: p.businessName,
    contactName: p.contactName,
    email: null,
    phone: null,
    whatsapp: null,
    website: p.website,
    instagramHandle: p.instagramHandle,
    niche,
    location: p.location,
    description: p.description,
    source: "AI_GENERATED" as ProspectSource,
    rating: null,
    reviewCount: null,
    notes: null,
  }));
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function discoverProspects(params: {
  niche: string;
  location: string;
  tenantId: string;
  saasId: string;
  campaignId: string | null;
}): Promise<RawProspect[]> {
  const bindings = env() as Record<string, unknown> | null;
  const mapsKey = typeof bindings?.GOOGLE_MAPS_API_KEY === "string"
    ? bindings.GOOGLE_MAPS_API_KEY
    : (typeof process !== "undefined" ? process.env.GOOGLE_MAPS_API_KEY : null);

  if (mapsKey) {
    try {
      const results = await discoverViaGoogleMaps(
        params.niche, params.location, mapsKey, params.tenantId, params.saasId, params.campaignId
      );
      if (results.length > 0) return results;
    } catch (e) {
      console.warn("[Prospector] Google Maps failed, falling back to Mistral:", e);
    }
  }

  return discoverViaMistral(params.niche, params.location, params.tenantId, params.saasId, params.campaignId);
}
