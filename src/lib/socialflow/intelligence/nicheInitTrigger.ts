import { env } from "@/lib/cf";
import { getChannelProfile } from "@/lib/socialflow/profile/repository";
import { getSocialFlowAccountTypeByTenant } from "@/lib/socialflow/auth/account-type";
import { resolveNicheSlug } from "./NicheIntelligenceService";
import { generateNicheAnalysis } from "./NicheIntelligenceCronAgent";

// Se llama cuando un tenant conecta su PRIMERA cuenta social (cualquier proveedor) —
// dispara de inmediato el análisis de nicho en vez de esperar hasta 7 días al cron
// semanal (runNicheIntelligenceCron). Fire-and-forget: nunca debe bloquear ni romper el
// callback de OAuth que lo llama — mismo patrón que el fire-and-forget de
// resolveNicheSlug (NicheIntelligenceService.ts:216, void + .catch, sin awaitar el
// resultado). El caller no necesita await ni try/catch propio: esta función nunca lanza.
export function triggerNicheInitializationOnFirstAccount(tenantId: string, saasId: string): void {
  void (async () => {
    try {
      const dracoEnv = env();
      const db = dracoEnv?.SOCIAL_DB;
      if (!db) return;

      const profile = await getChannelProfile(tenantId, saasId).catch(() => null);
      const rawNiche = profile?.niche?.trim();
      if (!rawNiche) return;

      // resolveNicheSlug ya hace los 3 niveles de matching (exacto, regex, sinónimos,
      // Mistral) y devuelve "" si no matchea ninguno de los 66 slugs — cubre "omitir
      // silenciosamente" sin lógica adicional aquí.
      const slug = await resolveNicheSlug(rawNiche, db, tenantId, saasId);
      if (!slug) return;

      const accountType = (await getSocialFlowAccountTypeByTenant(tenantId).catch(() => null)) ?? "influencer";

      await generateNicheAnalysis(slug, accountType, dracoEnv);
      console.log("[NicheInitTrigger] initialized on first account connect", { tenantId, saasId, niche: slug, accountType });
    } catch (err) {
      console.error("[NicheInitTrigger] failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    }
  })();
}
