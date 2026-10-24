import JSZip from "jszip";
import {
  createSocialFlowExportSocialReadPrepContract,
  type SocialFlowExportReadModelRecord,
} from "@/lib/socialflow/contracts/export-core-read";
import { resolveRuntimeSocialSaasSeedContract } from "./contracts/runtime-seed-contract";
import * as runtimeDb from "../db/runtime-db";

const ENSURE_RUNTIME_SOCIAL_DB_EXPORT_KEY = ["ensure", "Social", "Db"].join("");

function resolveRuntimeExportSocialDb(): D1Database | null {
  const ensureSocialDbCandidate = (runtimeDb as Record<string, unknown>)[ENSURE_RUNTIME_SOCIAL_DB_EXPORT_KEY];
  if (typeof ensureSocialDbCandidate !== "function") {
    return null;
  }

  try {
    return (ensureSocialDbCandidate as () => D1Database)();
  } catch {
    return null;
  }
}

function isPreparedReadModelUsable(model: SocialFlowExportReadModelRecord): boolean {
  if (model.status !== "ready") {
    return false;
  }

  const requiredStrings: Array<keyof SocialFlowExportReadModelRecord> = [
    "slug",
    "work_logs_csv",
    "orchestrator_messages_csv",
    "financials_csv",
    "economic_events_csv",
    "domains_json",
    "meta_json",
    "source_revision",
  ];

  for (const key of requiredStrings) {
    if (typeof model[key] !== "string") {
      return false;
    }
  }

  try {
    JSON.parse(model.blueprint_json || "{}");
    JSON.parse(model.domains_json || "[]");
    JSON.parse(model.meta_json || "{}");
    if (model.dossier_json && model.dossier_json.trim()) {
      JSON.parse(model.dossier_json);
    }
    return true;
  } catch {
    return false;
  }
}

async function resolvePreparedSocialExportReadModel(
  tenantId: string,
  saasId: string,
): Promise<SocialFlowExportReadModelRecord | null> {
  const socialDb = resolveRuntimeExportSocialDb();
  if (!socialDb) {
    return null;
  }

  try {
    const socialReadPrepContract = createSocialFlowExportSocialReadPrepContract({
      queryOne: <T>(sql: string, ...params: unknown[]) => runtimeDb.queryOne<T>(socialDb, sql, ...params),
      run: async () => true,
    });

    return await socialReadPrepContract.getPreparedExportReadModel(tenantId, saasId);
  } catch (error) {
    console.warn("SOCIALFLOW_RUNTIME_EXPORT_SOCIAL_DB_READ_UNAVAILABLE", {
      tenantId,
      saasId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function buildZipFromPreparedSocialReadModel(
  prepared: SocialFlowExportReadModelRecord,
): Promise<JSZip> {
  const zip = new JSZip();
  if (prepared.dossier_json && prepared.dossier_json.trim().length > 0) {
    zip.folder("dossier")?.file("dossier.json", prepared.dossier_json);
  }
  zip.folder("blueprint")?.file("blueprint.json", prepared.blueprint_json || "{}");
  zip.folder("execution")?.file("work_logs.csv", prepared.work_logs_csv);
  zip.folder("execution")?.file("orchestrator_messages.csv", prepared.orchestrator_messages_csv);
  zip.folder("economics")?.file("financials.csv", prepared.financials_csv);
  zip.folder("economics")?.file("economic_events.csv", prepared.economic_events_csv);
  zip.folder("domains")?.file("domain_status.json", prepared.domains_json || "[]");
  zip.file("meta.json", prepared.meta_json || "{}");
  return zip;
}

export async function generateRuntimeSocialFlowExportForTenant(tenantId: string): Promise<{ buffer: Buffer; filename: string }> {
  const seed = await resolveRuntimeSocialSaasSeedContract(tenantId);
  if (!seed) {
    throw new Error("SOCIALFLOW_EXPORT_SAAS_SEED_NOT_FOUND");
  }

  const preparedReadModel = await resolvePreparedSocialExportReadModel(tenantId, seed.id);
  if (!preparedReadModel || !isPreparedReadModelUsable(preparedReadModel)) {
    throw new Error("SOCIALFLOW_EXPORT_READ_MODEL_NOT_READY");
  }

  const zip = await buildZipFromPreparedSocialReadModel(preparedReadModel);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const exportSlug = preparedReadModel.slug?.trim() || seed.slug;
  const filename = `drako-export-${exportSlug}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.zip`;

  return { buffer, filename };
}
