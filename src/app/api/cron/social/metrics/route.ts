import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth, CronAuthError } from "@/lib/security/cron-auth";
import { processInstagramMetrics } from "@/lib/socialflow/meta/metrics-collector";
import { processLinkedInMetrics } from "@/lib/socialflow/linkedin/metrics-collector";
import { checkAllLinkedInAccountTokens } from "@/lib/socialflow/linkedin/token-health";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    verifyCronAuth(req);
  } catch (error) {
    if (error instanceof CronAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const instagram = await processInstagramMetrics();
    // Independiente del resultado de Instagram — un fallo de LinkedIn no debe
    // impedir que las métricas de Instagram se registren, y viceversa. Hoy
    // linkedin.skipped == linkedin.processed's total de cuentas casi siempre,
    // porque linkedin_cm_enabled es false para todas (ver metrics-collector.ts).
    let linkedin: Awaited<ReturnType<typeof processLinkedInMetrics>>;
    try {
      linkedin = await processLinkedInMetrics();
    } catch (linkedinError) {
      console.error("[SocialMetricsCron] LinkedIn metrics failed", linkedinError);
      linkedin = { processed: 0, errors: 1, skipped: 0 };
    }

    // Independiente también de las métricas — corre para TODAS las cuentas
    // LinkedIn conectadas (sin el gate de linkedin_cm_enabled que sí aplica a
    // `linkedin` arriba), porque el token necesita revisarse tenga o no la
    // cuenta Community Management activado.
    let linkedinTokenHealth: Awaited<ReturnType<typeof checkAllLinkedInAccountTokens>>;
    try {
      linkedinTokenHealth = await checkAllLinkedInAccountTokens();
    } catch (tokenHealthError) {
      console.error("[SocialMetricsCron] LinkedIn token health failed", tokenHealthError);
      linkedinTokenHealth = { checked: 0, errors: 1 };
    }

    return NextResponse.json({ success: true, instagram, linkedin, linkedinTokenHealth });
  } catch (error) {
    console.error("[SocialMetricsCron] Failed", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
