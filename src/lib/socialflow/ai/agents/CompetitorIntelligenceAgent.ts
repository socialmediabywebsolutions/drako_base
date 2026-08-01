import { env } from "@/lib/cf";
import { geocodeAddress, searchNearbyCompetitors } from "@/lib/google-places-client";
import { getLocal, updateLocalCoordinates } from "../../local/repository";
import type { EmpresaLocal } from "../../local/types";
import { defaultLocalModel } from "../models/localModel";
import type { CompetitorIntelligenceInput, CompetitorIntelligenceResult, LocalCompetitorProfile } from "../types";

const DEFAULT_RADIUS_KM = 5;

function buildPositioningPrompt(local: EmpresaLocal, competitors: LocalCompetitorProfile[], radiusKm: number): string {
  const competitorLines = competitors.length
    ? competitors
        .map(
          (c) =>
            `- ${c.name} (${c.address || "sin dirección"}) — rating ${c.rating ?? "N/A"} (${c.reviewCount ?? 0} reseñas), a ${c.distanceKm} km, nivel de precio ${c.priceLevel ?? "desconocido"}`,
        )
        .join("\n")
    : "No se encontraron competidores en el radio configurado.";

  return `Eres un analista de posicionamiento competitivo local. Negocio: "${local.businessName ?? "N/A"}" (categoría: ${local.niche ?? "sin categoría"}), ubicado en ${local.address ?? "dirección no especificada"}. Radio de análisis: ${radiusKm} km.

Competidores cercanos encontrados vía Google Maps:
${competitorLines}

Genera un informe de posicionamiento en español, en prosa (sin JSON, sin markdown), dirigido al dueño del negocio. Empieza con la conclusión y las ventajas competitivas más importantes en el primer párrafo, ya que el informe puede recortarse a los primeros 2000 caracteres al usarse como contexto. Menciona a los competidores más relevantes por nombre, compara rating y número de reseñas, y sugiere cómo diferenciarse.`;
}

// Independent from CompetitorAgent (which analyzes social-content patterns via pure LLM
// generation, no real data). This agent pulls real nearby businesses from Google Maps
// for the tenant's saas_empresa_local address and asks Mistral to turn that into a
// positioning report. Does NOT persist to the knowledge base itself — callers decide
// whether/how to save the result (see upsertKnowledgeDocByType, type "market_analysis").
export class CompetitorIntelligenceAgent {
  async run(input: CompetitorIntelligenceInput): Promise<CompetitorIntelligenceResult> {
    const { tenantId, saasId } = input;
    const radiusKm = input.radiusKm ?? DEFAULT_RADIUS_KM;

    const local = await getLocal(tenantId, saasId);
    if (!local || !local.address) {
      throw new Error("EMPRESA_LOCAL_NOT_CONFIGURED");
    }

    const apiKey = env()?.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_MAPS_API_KEY_NOT_CONFIGURED");
    }

    let { latitude: lat, longitude: lng, geocodedAt } = local;

    if (lat == null || lng == null) {
      const geocoded = await geocodeAddress(local.address, apiKey);
      if (!geocoded) {
        throw new Error("GEOCODING_FAILED");
      }
      lat = geocoded.lat;
      lng = geocoded.lng;
      geocodedAt = new Date().toISOString();
      // place_id isn't returned by the Geocoding API response we parse (only lat/lng) —
      // left null here; searchNearbyCompetitors results carry their own placeId per
      // competitor, which is what actually matters for this feature.
      await updateLocalCoordinates(tenantId, saasId, { latitude: lat, longitude: lng, placeId: null });
    }

    const textQuery = local.niche ? `${local.niche} cerca de ${local.address}` : local.address;
    const competitors = await searchNearbyCompetitors(lat, lng, radiusKm, apiKey, textQuery);

    const prompt = buildPositioningPrompt(local, competitors, radiusKm);
    const { data } = await defaultLocalModel.generateStructured<{ report: string }>(
      { prompt, tenantId, saasId },
      () => ({ report: "" }),
    );

    return {
      competitors,
      report: data.report,
      geocodedAt: geocodedAt ?? new Date().toISOString(),
    };
  }
}
