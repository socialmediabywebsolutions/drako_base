type Coordinates = {
  lat: number;
  lon: number;
};

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type CompetitorsProfile = {
  name: string;
  category: string;
  distanceKm: number | null;
  latitude: number;
  longitude: number;
  website: string | null;
  socialUrls: string[];
  source: "geo_radius" | "sector_fallback";
};

export type CompetitorsDiscoveryResult = {
  radiusKm: number;
  resolvedAddress: string | null;
  center: Coordinates | null;
  competitors: CompetitorsProfile[];
  warnings: string[];
};

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";
const DEFAULT_TIMEOUT_MS = 9000;
const MAX_COMPETITORS = 12;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const radiusEarthKm = 6371;
  const latDelta = toRadians(b.lat - a.lat);
  const lonDelta = toRadians(b.lon - a.lon);
  const sinLat = Math.sin(latDelta / 2);
  const sinLon = Math.sin(lonDelta / 2);
  const base =
    sinLat * sinLat +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLon * sinLon;
  const arc = 2 * Math.atan2(Math.sqrt(base), Math.sqrt(1 - base));
  return radiusEarthKm * arc;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSectorKeywords(sector: string | null | undefined): string[] {
  const raw = normalizeText(sector);
  if (!raw) return [];
  const tokens = raw
    .split(/[^a-z0-9]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
  return Array.from(new Set(tokens)).slice(0, 8);
}

function detectCategory(tags: Record<string, string> | undefined): string {
  if (!tags) return "business";
  return (
    tags.shop ||
    tags.amenity ||
    tags.office ||
    tags.craft ||
    tags.tourism ||
    tags.leisure ||
    "business"
  );
}

function extractSocialUrls(tags: Record<string, string> | undefined): string[] {
  if (!tags) return [];
  const keys = [
    "contact:facebook",
    "facebook",
    "contact:instagram",
    "instagram",
    "contact:linkedin",
    "linkedin",
    "contact:tiktok",
    "tiktok",
  ];
  const values = keys
    .map((key) => tags[key])
    .filter((item): item is string => Boolean(item))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return Array.from(new Set(values));
}

function elementCoordinates(element: OverpassElement): Coordinates | null {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return { lat: element.lat, lon: element.lon };
  }
  if (element.center && typeof element.center.lat === "number" && typeof element.center.lon === "number") {
    return { lat: element.center.lat, lon: element.center.lon };
  }
  return null;
}

function elementMatchesSector(element: OverpassElement, keywords: string[]): boolean {
  if (keywords.length === 0) return true;
  const tags = element.tags ?? {};
  const searchable = normalizeText(
    `${tags.name ?? ""} ${tags.shop ?? ""} ${tags.amenity ?? ""} ${tags.office ?? ""} ${tags.craft ?? ""}`,
  );
  return keywords.some((keyword) => searchable.includes(keyword));
}

async function fetchJsonWithTimeout<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "accept": "application/json",
        "user-agent": "drako-systems-competitors-agent/1.0 (ops@drako.systems)",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function geocodeAddress(address: string): Promise<{ center: Coordinates; displayName: string } | null> {
  const url = `${NOMINATIM_SEARCH_URL}?format=jsonv2&limit=1&email=ops%40drako.systems&q=${encodeURIComponent(address)}`;
  const payload = await fetchJsonWithTimeout<Array<{ lat: string; lon: string; display_name: string }>>(url);
  const first = payload[0];
  if (!first) return null;
  const lat = Number.parseFloat(first.lat);
  const lon = Number.parseFloat(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    center: { lat, lon },
    displayName: first.display_name,
  };
}

async function searchByGeoRadius(params: {
  center: Coordinates;
  radiusKm: number;
  sectorKeywords: string[];
}): Promise<CompetitorsProfile[]> {
  const radiusMeters = Math.max(1000, Math.round(params.radiusKm * 1000));
  const query = `
[out:json][timeout:25];
(
  node(around:${radiusMeters},${params.center.lat},${params.center.lon})["name"]["shop"];
  node(around:${radiusMeters},${params.center.lat},${params.center.lon})["name"]["amenity"];
  node(around:${radiusMeters},${params.center.lat},${params.center.lon})["name"]["office"];
  way(around:${radiusMeters},${params.center.lat},${params.center.lon})["name"]["shop"];
  way(around:${radiusMeters},${params.center.lat},${params.center.lon})["name"]["amenity"];
  way(around:${radiusMeters},${params.center.lat},${params.center.lon})["name"]["office"];
  relation(around:${radiusMeters},${params.center.lat},${params.center.lon})["name"]["shop"];
  relation(around:${radiusMeters},${params.center.lat},${params.center.lon})["name"]["amenity"];
  relation(around:${radiusMeters},${params.center.lat},${params.center.lon})["name"]["office"];
);
out center tags;
`;

  const payload = await fetchJsonWithTimeout<{ elements?: OverpassElement[] }>(OVERPASS_API_URL, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=UTF-8" },
    body: query,
  });

  const elements = payload.elements ?? [];
  const dedupe = new Map<string, CompetitorsProfile>();

  for (const element of elements) {
    const tags = element.tags ?? {};
    const name = tags.name?.trim();
    if (!name) continue;
    if (!elementMatchesSector(element, params.sectorKeywords)) continue;
    const location = elementCoordinates(element);
    if (!location) continue;

    const distanceKm = haversineDistanceKm(params.center, location);
    const key = `${normalizeText(name)}:${location.lat.toFixed(4)}:${location.lon.toFixed(4)}`;
    if (dedupe.has(key)) continue;

    dedupe.set(key, {
      name,
      category: detectCategory(tags),
      distanceKm: Number.parseFloat(distanceKm.toFixed(2)),
      latitude: location.lat,
      longitude: location.lon,
      website: tags.website ?? tags["contact:website"] ?? tags.url ?? null,
      socialUrls: extractSocialUrls(tags),
      source: "geo_radius",
    });
  }

  return Array.from(dedupe.values())
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
    .slice(0, MAX_COMPETITORS);
}

async function searchFallbackBySector(params: {
  sector: string;
  city: string;
}): Promise<CompetitorsProfile[]> {
  const query = `${params.sector} ${params.city}`.trim();
  if (!query) return [];
  const url = `${NOMINATIM_SEARCH_URL}?format=jsonv2&limit=${MAX_COMPETITORS}&email=ops%40drako.systems&q=${encodeURIComponent(query)}`;
  const payload = await fetchJsonWithTimeout<Array<{ lat: string; lon: string; display_name: string; type: string }>>(url);

  const competitors = payload
    .map((item) => {
      const lat = Number.parseFloat(item.lat);
      const lon = Number.parseFloat(item.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const name = item.display_name.split(",")[0]?.trim() || item.display_name.trim();
      if (!name) return null;
      return {
        name,
        category: item.type || "business",
        distanceKm: null,
        latitude: lat,
        longitude: lon,
        website: null,
        socialUrls: [],
        source: "sector_fallback" as const,
      };
    })
    .filter((item): item is CompetitorsProfile => Boolean(item));

  return competitors.slice(0, MAX_COMPETITORS);
}

export async function discoverCompetitors(params: {
  address: string;
  city: string;
  sector: string;
  radiusKm?: number;
}): Promise<CompetitorsDiscoveryResult> {
  const radiusKm = Number.isFinite(params.radiusKm) ? Math.max(1, Number(params.radiusKm)) : 5;
  const warnings: string[] = [];
  const sectorKeywords = buildSectorKeywords(params.sector);
  let center: Coordinates | null = null;
  let resolvedAddress: string | null = null;
  let competitors: CompetitorsProfile[] = [];

  try {
    const geocoded = await geocodeAddress(params.address);
    if (geocoded) {
      center = geocoded.center;
      resolvedAddress = geocoded.displayName;
      competitors = await searchByGeoRadius({
        center: geocoded.center,
        radiusKm,
        sectorKeywords,
      });
    } else {
      warnings.push("Address geocoding returned no results.");
    }
  } catch (error) {
    warnings.push(`Geo competitor search failed: ${error instanceof Error ? error.message : "unknown"}`);
  }

  if (competitors.length === 0) {
    try {
      competitors = await searchFallbackBySector({
        sector: params.sector,
        city: params.city,
      });
      if (competitors.length > 0) {
        warnings.push("Used sector fallback search because geo-radius search found no competitors.");
      }
    } catch (error) {
      warnings.push(`Sector fallback search failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  return {
    radiusKm,
    resolvedAddress,
    center,
    competitors,
    warnings,
  };
}
