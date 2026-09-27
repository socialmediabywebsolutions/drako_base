import { getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";
import { getSocialFlowAccountTypeByTenant } from "@/lib/socialflow/auth/account-type";
import { listSaasSocialAccounts, resolveSocialContext } from "@/lib/socialflow/repository";
import type { SaasSocialProvider } from "@/lib/social-core/types";
import { resolveSocialFlowPlanCode, type SocialFlowPlanCode } from "./plans";

// Redes incluidas por plan influencer. Sin extras: cada plan trae exactamente las
// redes anunciadas, nada más. TikTok y YouTube no tienen OAuth implementado todavía,
// así que no aparecen en ningún plan (se muestran como "Próximamente" en la UI).
const INFLUENCER_INCLUDED: Record<"free" | "influencer_starter" | "influencer_basico" | "influencer_pro", SaasSocialProvider[]> = {
  free: ["INSTAGRAM", "LINKEDIN"],
  influencer_starter: ["INSTAGRAM", "LINKEDIN"],
  influencer_basico: ["INSTAGRAM", "FACEBOOK_PAGE", "LINKEDIN"],
  influencer_pro: ["INSTAGRAM", "FACEBOOK_PAGE", "LINKEDIN"],
};

// Empresa Básico (y free con accountType empresa) permiten elegir UNA red principal entre
// Instagram/LinkedIn: la que ya esté conectada se considera la elegida; si ninguna lo está
// aún, ambas se muestran como disponibles hasta que se conecte la primera.
const EMPRESA_PICK_ONE: SaasSocialProvider[] = ["INSTAGRAM", "LINKEDIN"];

// Facebook Page va incluida en todos los planes empresa de pago, además de su red o redes
// principales (no cuenta dentro de la elección única de EMPRESA_PICK_ONE) — igual que en
// influencer_pro. free con accountType empresa no la incluye.
const EMPRESA_PLANS_WITH_FACEBOOK = new Set<SocialFlowPlanCode>(["empresa_starter", "empresa_basico", "empresa_pro"]);

export type NetworkEntitlementSnapshot = {
  planCode: SocialFlowPlanCode;
  accountType: "influencer" | "empresa" | null;
  included: Set<SaasSocialProvider>;
  connected: Set<SaasSocialProvider>;
};

export async function resolveNetworkEntitlements(input: {
  tenantId: string;
  saasId: string;
}): Promise<NetworkEntitlementSnapshot> {
  const [snapshot, ctx, accountType] = await Promise.all([
    getCanonicalBillingSnapshot({ tenantId: input.tenantId, saasSlug: "socialflow" }),
    resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId }),
    getSocialFlowAccountTypeByTenant(input.tenantId),
  ]);

  const planCode = resolveSocialFlowPlanCode(snapshot.subscription, {
    isInternalAccount: snapshot.isInternalAccount,
    accountType,
  });
  const accounts = await listSaasSocialAccounts(ctx);
  const connected = new Set(accounts.filter((account) => account.status !== "DISCONNECTED").map((account) => account.provider));

  let included: Set<SaasSocialProvider>;
  if (accountType === "empresa") {
    if (planCode === "empresa_pro") {
      included = new Set<SaasSocialProvider>(["INSTAGRAM", "LINKEDIN"]);
    } else {
      const alreadyPicked = EMPRESA_PICK_ONE.find((provider) => connected.has(provider));
      included = alreadyPicked ? new Set([alreadyPicked]) : new Set(EMPRESA_PICK_ONE);
    }
    if (EMPRESA_PLANS_WITH_FACEBOOK.has(planCode)) {
      included.add("FACEBOOK_PAGE");
    }
  } else {
    const key =
      planCode === "influencer_pro" ? "influencer_pro"
      : planCode === "influencer_basico" ? "influencer_basico"
      : planCode === "influencer_starter" ? "influencer_starter"
      : "free";
    included = new Set(INFLUENCER_INCLUDED[key]);
  }

  return { planCode, accountType, included, connected };
}

export type NetworkGuardResult =
  | { ok: true }
  | { ok: false; code: "NETWORK_REQUIRES_UPGRADE"; planCode: SocialFlowPlanCode; message: string };

/**
 * Solo bloquea intentos de CONECTAR una red nueva que sea "extra" para el plan.
 * Nunca bloquea una red que el tenant ya tiene conectada — evita desconectar o
 * romper cuentas existentes (p.ej. Facebook Page ya conectada por cuentas empresa).
 *
 * Falla abierto (permite continuar) si no se puede resolver el entitlement por un
 * problema de infraestructura (DB no disponible, etc.) — un fallo aquí no debe
 * bloquear el flujo de conexión OAuth en producción.
 */
export async function guardNetworkEntitlement(input: {
  tenantId: string;
  saasId: string;
  provider: SaasSocialProvider;
}): Promise<NetworkGuardResult> {
  let snapshot: NetworkEntitlementSnapshot;
  try {
    snapshot = await resolveNetworkEntitlements({ tenantId: input.tenantId, saasId: input.saasId });
  } catch (error) {
    console.warn("SOCIALFLOW_NETWORK_ENTITLEMENT_RESOLUTION_FAILED", error instanceof Error ? error.message : error);
    return { ok: true };
  }

  if (snapshot.connected.has(input.provider) || snapshot.included.has(input.provider)) {
    return { ok: true };
  }

  return {
    ok: false,
    code: "NETWORK_REQUIRES_UPGRADE",
    planCode: snapshot.planCode,
    message: "Esta red no está incluida en tu plan actual. Actualiza tu plan o contrátala como extra para conectarla.",
  };
}
