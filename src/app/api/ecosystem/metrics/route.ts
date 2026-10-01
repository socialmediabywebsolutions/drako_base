export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  buildMockSummary,
  getEcosystemSummary,
  type EcosystemPlatform,
  type EcosystemSummary,
} from "@/lib/drako/EcosystemMetricsAgent";

// GET /api/ecosystem/metrics — últimas métricas sociales de cada SaaS del ecosistema.
// Público, cacheado 1 h (el cron solo las refresca una vez al día). Si D1 falla se
// sirven los mocks con un max-age corto para no fijar el fallo en la caché.
function toResponse(summary: EcosystemSummary) {
  return {
    lastUpdated: summary.lastUpdated,
    ecosystem: summary.ecosystem.map((saas) => ({
      id: saas.id,
      name: saas.name,
      status: saas.status,
      progress: saas.progress,
      platforms: Object.fromEntries(
        (Object.entries(saas.platforms) as [EcosystemPlatform, NonNullable<(typeof saas.platforms)[EcosystemPlatform]>][]).map(
          ([platform, m]) => [
            platform,
            {
              followers: m.followers,
              posts: m.posts,
              engagement: m.engagementRate,
              reach7d: m.reach7d,
              impressions7d: m.impressions7d,
              username: m.username ?? "",
              profileUrl: m.profileUrl,
              source: m.source,
            },
          ],
        ),
      ),
    })),
  };
}

export async function GET() {
  try {
    const summary = await getEcosystemSummary();
    return NextResponse.json(toResponse(summary), {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch (error) {
    console.error("ECOSYSTEM_METRICS_READ_ERROR", error instanceof Error ? error.message : String(error));
    return NextResponse.json(toResponse(buildMockSummary()), {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  }
}
