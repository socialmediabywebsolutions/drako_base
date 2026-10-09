import type { GooglePriceLevel, LocalCompetitorProfile } from "@/lib/socialflow/ai/types";

const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const TEXT_SEARCH_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.location";
const MAX_RADIUS_KM = 50; // Places API (New) circle bias/restriction hard limit is 50000 meters
const MAX_RESULT_COUNT = 20; // searchText hard limit

// Geocoding API has no "New" variant (that branding only applies to Places), so this
// still hits the classic REST endpoint used by the legacy src/app/api/analysis/geo
// pipeline. Never throws — returns null on any network/API/parse failure so callers can
// degrade gracefully instead of crashing the agent run.
export async function geocodeAddress(
  address: string,
  apiKey: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim() || !apiKey) return null;

  try {
    const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error("GOOGLE_GEOCODE_HTTP_ERROR", res.status);
      return null;
    }

    const data = (await res.json()) as {
      status?: string;
      results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
    };

    if (data.status !== "OK") {
      console.error("GOOGLE_GEOCODE_API_ERROR", data.status);
      return null;
    }

    const location = data.results?.[0]?.geometry?.location;
    if (typeof location?.lat !== "number" || typeof location?.lng !== "number") return null;

    return { lat: location.lat, lng: location.lng };
  } catch (error) {
    console.error("GOOGLE_GEOCODE_FAILED", error);
    return null;
  }
}

// Inverso de geocodeAddress (lat/lng → nombre del lugar) — mismo endpoint clásico
// (Geocoding API no tiene variante "New"), mismo patrón defensivo: nunca lanza, null en
// cualquier fallo de red/API/parseo. Ver Sprint I (geolocalización narrativa) — usado por
// generate-from-image para traducir el GPS de los EXIF de una foto a un nombre de lugar
// legible antes de pedirle contexto a Wikipedia.
export async function reverseGeocode(lat: number, lng: number, apiKey: string): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !apiKey) return null;

  try {
    const url = `${GEOCODE_URL}?latlng=${lat},${lng}&key=${apiKey}&language=es`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error("GOOGLE_REVERSE_GEOCODE_HTTP_ERROR", res.status);
      return null;
    }

    const data = (await res.json()) as {
      status?: string;
      results?: { formatted_address?: string }[];
    };

    if (data.status !== "OK") {
      console.error("GOOGLE_REVERSE_GEOCODE_API_ERROR", data.status);
      return null;
    }

    const formattedAddress = data.results?.[0]?.formatted_address;
    return typeof formattedAddress === "string" && formattedAddress.trim() ? formattedAddress.trim() : null;
  } catch (error) {
    console.error("GOOGLE_REVERSE_GEOCODE_FAILED", error);
    return null;
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type PlaceResult = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: GooglePriceLevel;
  location?: { latitude?: number; longitude?: number };
};

type PlacesSearchResponse = {
  places?: PlaceResult[];
  error?: { status?: string; message?: string };
};

// Places API (New) Text Search — POST + X-Goog-FieldMask, not the legacy GET
// nearbysearch/textsearch endpoints. Uses searchText (not searchNearby) because
// searchNearby only accepts `includedTypes` from Google's fixed place-type enum, while
// EmpresaLocal.niche is free text (e.g. "peluquería") that wouldn't match it. textQuery
// here should already combine niche + address (e.g. built by the caller as
// "${niche} cerca de ${address}"). Never throws — returns [] on any network/API/parse
// failure.
//
// locationBias (not locationRestriction — Text Search (New) only accepts a rectangle for
// locationRestriction, not a circle) nudges results toward lat/lng+radiusKm but doesn't
// hard-enforce it, so results are post-filtered below by the haversine distanceKm to
// actually honor "radio de X km".
export async function searchNearbyCompetitors(
  lat: number,
  lng: number,
  radiusKm: number,
  apiKey: string,
  textQuery?: string,
): Promise<LocalCompetitorProfile[]> {
  if (
    !apiKey ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(radiusKm) ||
    radiusKm <= 0 ||
    !textQuery?.trim()
  ) {
    return [];
  }

  try {
    const res = await fetch(TEXT_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": TEXT_SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: MAX_RESULT_COUNT,
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: Math.min(radiusKm, MAX_RADIUS_KM) * 1000,
          },
        },
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as PlacesSearchResponse | null;
      console.error("GOOGLE_PLACES_TEXT_SEARCH_HTTP_ERROR", res.status, body?.error?.message ?? "");
      return [];
    }

    const data = (await res.json()) as PlacesSearchResponse;
    const places = data.places ?? [];

    return places
      .filter(
        (place): place is PlaceResult & { id: string; location: { latitude: number; longitude: number } } =>
          typeof place.id === "string" &&
          typeof place.location?.latitude === "number" &&
          typeof place.location?.longitude === "number",
      )
      .map((place) => ({
        placeId: place.id,
        name: place.displayName?.text ?? "Sin nombre",
        address: place.formattedAddress ?? "",
        rating: typeof place.rating === "number" ? place.rating : null,
        reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
        priceLevel: place.priceLevel ?? null,
        distanceKm:
          Math.round(haversineKm(lat, lng, place.location.latitude, place.location.longitude) * 10) / 10,
      }))
      .filter((competitor) => competitor.distanceKm <= radiusKm);
  } catch (error) {
    console.error("GOOGLE_PLACES_TEXT_SEARCH_FAILED", error);
    return [];
  }
}
