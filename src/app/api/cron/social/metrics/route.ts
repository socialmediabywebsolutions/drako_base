import { NextRequest, NextResponse } from "next/server";
import { verifyCronAuth, CronAuthError } from "@/lib/security/cron-auth";
import { guardCronTurn } from "@/lib/security/cron-lock";
import { processFacebookPageMetrics, processInstagramMetrics } from "@/lib/socialflow/meta/metrics-collector";
import { processLinkedInMetrics } from "@/lib/socialflow/linkedin/metrics-collector";
import { checkAllLinkedInAccountTokens } from "@/lib/socialflow/linkedin/token-health";
import { insertAgentExecutionLog } from "@/lib/socialflow/intelligence/agent-execution-log";
import { env } from "@/lib/cf";

export const dynamic = "force-dynamic";

// Una fila por ejecución en agent_execution_log (agent_name='MetricsCron') — hasta ahora
// los fallos del recolector solo iban a console.error y eran invisibles salvo con
// `wrangler tail` en directo. Un fallo al escribir el log nunca tumba el cron.
async function logMetricsCronExecution(startedAt: string, rowsWritten: number | null, errorMessage: string | null): Promise<void> {
  const db = env()?.SOCIAL_DB;
  if (!db) return;
  await insertAgentExecutionLog(db, {
    agentName: "MetricsCron",
    tenantId: null,
    saasId: null,
    startedAt,
    finishedAt: new Date().toISOString(),
    status: errorMessage ? "error" : "success",
    rowsWritten,
    errorMessage: errorMessage ? errorMessage.slice(0, 500) : null,
  }).catch((err) => console.error("[SocialMetricsCron] agent_execution_log insert failed", err));
}

export async function GET(req: NextRequest) {
  try {
    verifyCronAuth(req);
  } catch (error) {
    if (error instanceof CronAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locked = await guardCronTurn(req, "metrics", 240);
  if (locked) return locked;

  const startedAt = new Date().toISOString();
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

    // Páginas de Facebook — independiente de Instagram/LinkedIn: un fallo aquí no afecta
    // a las otras redes.
    let facebook: Awaited<ReturnType<typeof processFacebookPageMetrics>>;
    try {
      facebook = await processFacebookPageMetrics();
    } catch (facebookError) {
      console.error("[SocialMetricsCron] Facebook Page metrics failed", facebookError);
      facebook = { processed: 0, errors: 1, rowsWritten: 0, firstError: facebookError instanceof Error ? facebookError.message : String(facebookError) };
    }

    await logMetricsCronExecution(startedAt, instagram.rowsWritten + facebook.rowsWritten, instagram.firstError ?? facebook.firstError);

    return NextResponse.json({ success: true, instagram, facebook, linkedin, linkedinTokenHealth });
  } catch (error) {
    console.error("[SocialMetricsCron] Failed", error);
    await logMetricsCronExecution(startedAt, null, error instanceof Error ? error.message : String(error));
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
