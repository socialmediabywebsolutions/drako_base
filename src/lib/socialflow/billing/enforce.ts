import { getCanonicalBillingSnapshot, type CanonicalBillingSnapshot } from "@/lib/billing/subscriptions";
import { getSocialFlowAccountTypeByTenant } from "@/lib/socialflow/auth/account-type";
import { countSaasSocialPostsInRange, listSaasSocialAccounts, resolveSocialContext } from "@/lib/socialflow/repository";
import { resolveSocialFlowPlanCode, type SocialFlowPlanCode } from "./plans";

// Todas las páginas del workspace SocialFlow operan sobre este único saasId (ver
// SAAS_ID en publicar/page.tsx, upload/page.tsx, etc.) — no es multi-saas por tenant.
const SOCIALFLOW_SAAS_ID = "socialflow";

// El fetch de accountType solo se dispara cuando isInternalAccount es true (caso
// raro, gestionado a mano) — evita añadir una consulta extra a SOCIALFLOW_AUTHS_DB
// en el camino caliente de cada tenant normal.
async function resolvePlanCode(tenantId: string, snapshot: CanonicalBillingSnapshot): Promise<SocialFlowPlanCode> {
  if (!snapshot.isInternalAccount) {
    return resolveSocialFlowPlanCode(snapshot.subscription);
  }
  const accountType = await getSocialFlowAccountTypeByTenant(tenantId);
  return resolveSocialFlowPlanCode(snapshot.subscription, { isInternalAccount: true, accountType });
}

// Sin extras ni add-ons: el límite de canales coincide exactamente con el número
// de redes incluidas en cada plan (ver network-entitlements.ts).
const PLAN_MAX_CHANNELS: Record<SocialFlowPlanCode, number> = {
  free: 1,
  influencer_starter: 1,  // Instagram
  influencer_basico: 1,   // Instagram
  influencer_pro: 2,      // Instagram + Facebook
  empresa_starter: 1,     // Instagram o LinkedIn (a elegir)
  empresa_basico: 1,      // Instagram o LinkedIn (a elegir)
  empresa_pro: 2,         // Instagram + LinkedIn
};

// Cuota de publicaciones de Instagram por SEMANA (lunes-domingo) — sustituye al
// antiguo PLAN_DAILY_MULTIPLIER × días_del_mes. Diferenciada por tipo de cliente:
// empresa es 2 menos que influencer en cada tier. Ver getWeeklyPublishStatus.
const PLAN_INSTAGRAM_WEEKLY_LIMIT: Record<Exclude<SocialFlowPlanCode, "free">, number> = {
  influencer_starter: 8,
  influencer_basico: 12,
  influencer_pro: 14,
  empresa_starter: 6,
  empresa_basico: 10,
  empresa_pro: 12,
};

// Historias tiene su propio techo diario, independiente del DAILY_CAP de feed/reel/
// carrusel — replica "N historias/día" de las features en plans.ts (starter=1, resto=2).
// Simétrico influencer/empresa (a diferencia de PLAN_INSTAGRAM_WEEKLY_LIMIT arriba).
const PLAN_STORIES_DAILY_CAP: Record<Exclude<SocialFlowPlanCode, "free">, number> = {
  influencer_starter: 1,
  influencer_basico: 2,
  influencer_pro: 2,
  empresa_starter: 1,
  empresa_basico: 2,
  empresa_pro: 2,
};

// Cuota de publicaciones de LinkedIn por SEMANA — ventana y carryover independientes
// de Instagram, mismo mecanismo de acumulación de 1 semana. Simétrico influencer/
// empresa. Fuente de verdad del copy en plans.ts, no al revés.
const PLAN_LINKEDIN_WEEKLY_LIMIT: Record<Exclude<SocialFlowPlanCode, "free">, number> = {
  influencer_starter: 2,
  influencer_basico: 3,
  influencer_pro: 5,
  empresa_starter: 2,
  empresa_basico: 3,
  empresa_pro: 5,
};

// Techo diario de publicaciones — protege el alcance orgánico (el algoritmo penaliza
// cuentas que publican más de 2 veces al día). A diferencia de la cuota semanal/mensual,
// este SÍ bloquea: es el único límite que canPublishNow hace cumplir de verdad.
const DAILY_CAP = 2;

// Slides fijos por plan para el formato Carrusel — Starter=2, Básico=4, Pro=6,
// simétrico entre influencer_ y empresa_ (a diferencia de PLAN_INSTAGRAM_WEEKLY_LIMIT).
const CAROUSEL_SLIDES_PER_PLAN: Record<Exclude<SocialFlowPlanCode, "free">, number> = {
  influencer_starter: 2,
  influencer_basico: 4,
  influencer_pro: 6,
  empresa_starter: 2,
  empresa_basico: 4,
  empresa_pro: 6,
};

// --- Helpers de fechas UTC para el reset semanal (lunes 00:00 UTC) ---

function startOfUtcDay(reference: Date): Date {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));
}

function addUtcDays(reference: Date, days: number): Date {
  const copy = new Date(reference);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

// Lunes 00:00 UTC de la semana que contiene `reference`.
function startOfUtcWeek(reference: Date): Date {
  const day = startOfUtcDay(reference);
  const daysSinceMonday = (day.getUTCDay() + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
  return addUtcDays(day, -daysSinceMonday);
}

function startOfUtcMonth(reference: Date): Date {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
}

function startOfNextUtcMonth(reference: Date): Date {
  return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1));
}

const PLAN_AI_ALLOWED: Record<SocialFlowPlanCode, boolean> = {
  free: false,
  influencer_starter: true,
  influencer_basico: true,
  influencer_pro: true,
  empresa_starter: true,
  empresa_basico: true,
  empresa_pro: true,
};

export type PlanGuardResult =
  | { ok: true; planCode: SocialFlowPlanCode }
  | { ok: false; code: string; message: string; planCode: SocialFlowPlanCode };

export async function guardChannelLimit(
  tenantId: string,
  saasId: string,
): Promise<PlanGuardResult> {
  const [snapshot, ctx] = await Promise.all([
    getCanonicalBillingSnapshot({ tenantId, saasSlug: "socialflow" }),
    resolveSocialContext({ tenantId, saasId }),
  ]);

  const planCode = await resolvePlanCode(tenantId, snapshot);
  const maxChannels = PLAN_MAX_CHANNELS[planCode];
  const accounts = await listSaasSocialAccounts(ctx);
  const activeCount = accounts.filter((a) => a.status !== "DISCONNECTED").length;

  if (activeCount >= maxChannels) {
    const limitLabel = maxChannels === Infinity ? "ilimitados" : String(maxChannels);
    return {
      ok: false,
      code: "PLAN_CHANNEL_LIMIT_REACHED",
      message: `Tu plan ${planCode} permite hasta ${limitLabel} canal${maxChannels === 1 ? "" : "es"} conectado${maxChannels === 1 ? "" : "s"}. Actualiza tu plan para conectar más.`,
      planCode,
    };
  }

  return { ok: true, planCode };
}

// Tenants and roles that always get AI access regardless of Stripe plan.
// Remove once live-mode billing is active for all customers.
const AI_BYPASS_TENANT_IDS = new Set(["socialflow-core"]);
const AI_BYPASS_ROLES = new Set(["owner", "admin"]);

export async function guardAiAccess(
  tenantId: string,
  role?: string,
): Promise<PlanGuardResult> {
  if (AI_BYPASS_TENANT_IDS.has(tenantId) || (role && AI_BYPASS_ROLES.has(role))) {
    return { ok: true, planCode: "influencer_pro" };
  }

  const snapshot = await getCanonicalBillingSnapshot({ tenantId, saasSlug: "socialflow" });
  const planCode = await resolvePlanCode(tenantId, snapshot);

  if (!PLAN_AI_ALLOWED[planCode]) {
    return {
      ok: false,
      code: "PLAN_AI_ACCESS_DENIED",
      message: "La generación de campañas con IA requiere un plan de pago. Actualiza a Creator o Pro para desbloquearla.",
      planCode,
    };
  }

  return { ok: true, planCode };
}

export async function isActiveSocialFlowTrial(tenantId: string, role?: string): Promise<boolean> {
  if (AI_BYPASS_TENANT_IDS.has(tenantId) || (role && AI_BYPASS_ROLES.has(role))) return false;
  const snapshot = await getCanonicalBillingSnapshot({ tenantId, saasSlug: "socialflow" });
  const sub = snapshot.subscription;
  const trialEndsAt = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  return sub.status === "trial" && trialEndsAt !== null && trialEndsAt > new Date();
}

// Con el modelo semanal, lo que se limita por plan es la PUBLICACIÓN (ver
// PLAN_INSTAGRAM_WEEKLY_LIMIT / getWeeklyPublishStatus / canPublishNow), no la subida de
// material — un usuario puede preparar/subir de golpe todo lo que quiera y dejarlo en
// borrador; el gate real ocurre al publicar. Este valor es solo un techo técnico de
// lote (evitar payloads gigantes en una sola subida), no un límite de plan, por eso ya
// no depende de tenantId/role/plan como antes.
const UPLOAD_BATCH_LIMIT = 10;

export async function getUploadBatchLimit(_tenantId: string, _role?: string): Promise<number> {
  return UPLOAD_BATCH_LIMIT;
}

export type WeeklyPublishStatus = {
  instagram: { used: number; limit: number; remaining: number; isOverQuota: boolean };
  instagramDaily: { used: number; cap: number; isAtCap: boolean };
  instagramMonthly: { used: number; limit: number; remaining: number };
  stories: { used: number; cap: number; isAtCap: boolean };
  linkedin: { used: number; limit: number; remaining: number; isOverQuota: boolean };
};

const PUBLISHED_STATUSES = ["POSTED", "SCHEDULED"];

// Estado de consumo de la cuota de publicación del tenant, por plataforma. Historias es
// un bucket 100% separado del semanal combinado de Instagram (no compite con él) — spec
// original: "Stories are separate... don't compete with weekly total". El sobrante de la
// semana pasada (si no se agotó su cuota) se suma a la cuota semanal de esta semana,
// tanto para Instagram como para LinkedIn — máx. 1 semana de acumulación: solo se mira
// la semana inmediatamente anterior, no se encadenan sobrantes de semanas más lejanas.
export async function getWeeklyPublishStatus(tenantId: string, role?: string): Promise<WeeklyPublishStatus> {
  const isBypass = AI_BYPASS_TENANT_IDS.has(tenantId) || (role !== undefined && AI_BYPASS_ROLES.has(role));
  const planCode: SocialFlowPlanCode = isBypass
    ? "influencer_pro"
    : await resolvePlanCode(tenantId, await getCanonicalBillingSnapshot({ tenantId, saasSlug: "socialflow" }));

  const igWeeklyBase = planCode === "free" ? 0 : PLAN_INSTAGRAM_WEEKLY_LIMIT[planCode];
  const igMonthlyLimit = igWeeklyBase * 4;
  const storiesCap = planCode === "free" ? 0 : PLAN_STORIES_DAILY_CAP[planCode];
  const linkedinWeeklyBase = planCode === "free" ? 0 : PLAN_LINKEDIN_WEEKLY_LIMIT[planCode];

  const ctx = await resolveSocialContext({ tenantId, saasId: SOCIALFLOW_SAAS_ID });

  const now = new Date();
  const dayStart = startOfUtcDay(now);
  const dayEnd = addUtcDays(dayStart, 1);
  const weekStart = startOfUtcWeek(now);
  const weekEnd = addUtcDays(weekStart, 7);
  const prevWeekStart = addUtcDays(weekStart, -7);
  const monthStart = startOfUtcMonth(now);
  const monthEnd = startOfNextUtcMonth(now);

  const igContentFilter = { provider: "INSTAGRAM" as const, excludeContentTypes: ["STORY" as const] };
  const [igDailyUsed, igWeeklyUsed, igMonthlyUsed, igPrevWeekUsed, storiesUsed, linkedinWeeklyUsed, linkedinPrevWeekUsed] = await Promise.all([
    countSaasSocialPostsInRange(ctx, dayStart.toISOString(), dayEnd.toISOString(), PUBLISHED_STATUSES, igContentFilter),
    countSaasSocialPostsInRange(ctx, weekStart.toISOString(), weekEnd.toISOString(), PUBLISHED_STATUSES, igContentFilter),
    countSaasSocialPostsInRange(ctx, monthStart.toISOString(), monthEnd.toISOString(), PUBLISHED_STATUSES, igContentFilter),
    countSaasSocialPostsInRange(ctx, prevWeekStart.toISOString(), weekStart.toISOString(), PUBLISHED_STATUSES, igContentFilter),
    countSaasSocialPostsInRange(ctx, dayStart.toISOString(), dayEnd.toISOString(), PUBLISHED_STATUSES, { provider: "INSTAGRAM", contentType: "STORY" }),
    countSaasSocialPostsInRange(ctx, weekStart.toISOString(), weekEnd.toISOString(), PUBLISHED_STATUSES, { provider: "LINKEDIN" }),
    countSaasSocialPostsInRange(ctx, prevWeekStart.toISOString(), weekStart.toISOString(), PUBLISHED_STATUSES, { provider: "LINKEDIN" }),
  ]);

  const igCarryover = Math.max(0, igWeeklyBase - igPrevWeekUsed);
  const igWeeklyLimit = igWeeklyBase + igCarryover;
  const linkedinCarryover = Math.max(0, linkedinWeeklyBase - linkedinPrevWeekUsed);
  const linkedinWeeklyLimit = linkedinWeeklyBase + linkedinCarryover;

  return {
    instagram: { used: igWeeklyUsed, limit: igWeeklyLimit, remaining: Math.max(0, igWeeklyLimit - igWeeklyUsed), isOverQuota: igWeeklyUsed >= igWeeklyLimit },
    instagramDaily: { used: igDailyUsed, cap: DAILY_CAP, isAtCap: igDailyUsed >= DAILY_CAP },
    instagramMonthly: { used: igMonthlyUsed, limit: igMonthlyLimit, remaining: Math.max(0, igMonthlyLimit - igMonthlyUsed) },
    stories: { used: storiesUsed, cap: storiesCap, isAtCap: storiesUsed >= storiesCap },
    linkedin: { used: linkedinWeeklyUsed, limit: linkedinWeeklyLimit, remaining: Math.max(0, linkedinWeeklyLimit - linkedinWeeklyUsed), isOverQuota: linkedinWeeklyUsed >= linkedinWeeklyLimit },
  };
}

// Único gate que bloquea de verdad: el techo diario de Instagram (DAILY_CAP). La cuota
// semanal/mensual de Instagram y LinkedIn, y el techo diario de Historias, son
// informativos (isOverQuota / isAtCap) y nunca impiden publicar.
export async function canPublishNow(tenantId: string, role?: string): Promise<boolean> {
  const status = await getWeeklyPublishStatus(tenantId, role);
  return status.instagramDaily.used < status.instagramDaily.cap;
}

// Techo de fotos/slides para el formato Carrusel — a diferencia de
// getWeeklyPublishStatus (cuota semanal de publicaciones), este número es FIJO por
// plan y no está ligado a ninguna ventana de tiempo. free y trial devuelven 0: como el
// mínimo real de un carrusel es 2 (CAROUSEL_MIN_SLIDES en publish-carrusel.tsx), un
// techo de 0 deja el botón "Generar carrusel" deshabilitado sin necesitar un gate aparte.
export async function getCarouselSlideLimit(tenantId: string, role?: string): Promise<number> {
  if (AI_BYPASS_TENANT_IDS.has(tenantId) || (role && AI_BYPASS_ROLES.has(role))) {
    return CAROUSEL_SLIDES_PER_PLAN.influencer_pro;
  }
  const snapshot = await getCanonicalBillingSnapshot({ tenantId, saasSlug: "socialflow" });
  const sub = snapshot.subscription;

  const trialEndsAt = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const isActiveTrial = sub.status === "trial" && trialEndsAt !== null && trialEndsAt > new Date();
  if (isActiveTrial) return 0;

  const planCode = await resolvePlanCode(tenantId, snapshot);
  if (planCode === "free") return 0;
  return CAROUSEL_SLIDES_PER_PLAN[planCode];
}
