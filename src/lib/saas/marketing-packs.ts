export type MarketingPackTier = "BASIC" | "STANDARD" | "FULL";

export type MarketingPackDefinition = {
  id: string;
  verticalId: string | null;
  tier: MarketingPackTier;
  label: string;
  description: string;
  includedPostsPerMonth: number;
  includedCampaignsPerMonth: number;
  recommendedMonthlyPrice: number;
};

const PACKS: MarketingPackDefinition[] = [
  {
    id: "salon_basic",
    verticalId: "SALON",
    tier: "BASIC",
    label: "Marketing Basic",
    description: "Posts orgánicos esenciales para mantener presencia.",
    includedPostsPerMonth: 8,
    includedCampaignsPerMonth: 0,
    recommendedMonthlyPrice: 120,
  },
  {
    id: "salon_standard",
    verticalId: "SALON",
    tier: "STANDARD",
    label: "Marketing Standard",
    description: "Calendario continuo con apoyo de campañas.",
    includedPostsPerMonth: 12,
    includedCampaignsPerMonth: 1,
    recommendedMonthlyPrice: 220,
  },
  {
    id: "salon_full",
    verticalId: "SALON",
    tier: "FULL",
    label: "Marketing Full",
    description: "Presencia intensiva con campañas recurrentes.",
    includedPostsPerMonth: 20,
    includedCampaignsPerMonth: 2,
    recommendedMonthlyPrice: 380,
  },
  {
    id: "clinic_basic",
    verticalId: "CLINIC",
    tier: "BASIC",
    label: "Marketing Basic",
    description: "Contenido base para agenda estable.",
    includedPostsPerMonth: 6,
    includedCampaignsPerMonth: 0,
    recommendedMonthlyPrice: 140,
  },
  {
    id: "clinic_standard",
    verticalId: "CLINIC",
    tier: "STANDARD",
    label: "Marketing Standard",
    description: "Más volumen y campañas segmentadas.",
    includedPostsPerMonth: 12,
    includedCampaignsPerMonth: 1,
    recommendedMonthlyPrice: 260,
  },
  {
    id: "clinic_full",
    verticalId: "CLINIC",
    tier: "FULL",
    label: "Marketing Full",
    description: "Cobertura completa con campañas intensivas.",
    includedPostsPerMonth: 20,
    includedCampaignsPerMonth: 2,
    recommendedMonthlyPrice: 420,
  },
  {
    id: "grooming_basic",
    verticalId: "PET_GROOMING",
    tier: "BASIC",
    label: "Marketing Basic",
    description: "Presencia semanal con posts clave.",
    includedPostsPerMonth: 8,
    includedCampaignsPerMonth: 0,
    recommendedMonthlyPrice: 120,
  },
  {
    id: "grooming_standard",
    verticalId: "PET_GROOMING",
    tier: "STANDARD",
    label: "Marketing Standard",
    description: "Más posts y campañas estacionales.",
    includedPostsPerMonth: 12,
    includedCampaignsPerMonth: 1,
    recommendedMonthlyPrice: 210,
  },
  {
    id: "grooming_full",
    verticalId: "PET_GROOMING",
    tier: "FULL",
    label: "Marketing Full",
    description: "Contenido intenso y campañas continuas.",
    includedPostsPerMonth: 18,
    includedCampaignsPerMonth: 2,
    recommendedMonthlyPrice: 340,
  },
  {
    id: "laundry_basic",
    verticalId: "LAUNDRY",
    tier: "BASIC",
    label: "Marketing Basic",
    description: "Contenido base con foco local.",
    includedPostsPerMonth: 6,
    includedCampaignsPerMonth: 0,
    recommendedMonthlyPrice: 110,
  },
  {
    id: "laundry_standard",
    verticalId: "LAUNDRY",
    tier: "STANDARD",
    label: "Marketing Standard",
    description: "Mayor volumen y campañas ligeras.",
    includedPostsPerMonth: 10,
    includedCampaignsPerMonth: 1,
    recommendedMonthlyPrice: 190,
  },
  {
    id: "laundry_full",
    verticalId: "LAUNDRY",
    tier: "FULL",
    label: "Marketing Full",
    description: "Cobertura intensiva en redes.",
    includedPostsPerMonth: 16,
    includedCampaignsPerMonth: 2,
    recommendedMonthlyPrice: 310,
  },
  {
    id: "default_basic",
    verticalId: null,
    tier: "BASIC",
    label: "Marketing Basic",
    description: "Base de publicaciones orgánicas.",
    includedPostsPerMonth: 8,
    includedCampaignsPerMonth: 0,
    recommendedMonthlyPrice: 120,
  },
  {
    id: "default_standard",
    verticalId: null,
    tier: "STANDARD",
    label: "Marketing Standard",
    description: "Posts + campañas para escalar.",
    includedPostsPerMonth: 12,
    includedCampaignsPerMonth: 1,
    recommendedMonthlyPrice: 220,
  },
  {
    id: "default_full",
    verticalId: null,
    tier: "FULL",
    label: "Marketing Full",
    description: "Presencia intensiva y campañas.",
    includedPostsPerMonth: 20,
    includedCampaignsPerMonth: 2,
    recommendedMonthlyPrice: 360,
  },
];

const TIER_ORDER: MarketingPackTier[] = ["BASIC", "STANDARD", "FULL"];

export function getMarketingPacksForVertical(verticalId: string | null): MarketingPackDefinition[] {
  const verticalPacks = PACKS.filter((pack) => pack.verticalId === verticalId);
  if (verticalPacks.length > 0) {
    return verticalPacks.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  }
  return PACKS.filter((pack) => pack.verticalId === null).sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
  );
}

export function findBestMatchingPackForPlan(args: {
  verticalId: string | null;
  plan: { includedPostsPerMonth: number; includedCampaignsPerMonth: number };
}): { pack: MarketingPackDefinition | null; tier: MarketingPackTier | null } {
  const packs = getMarketingPacksForVertical(args.verticalId);
  if (packs.length === 0) return { pack: null, tier: null };

  const scored = packs.map((pack) => {
    const postsDelta = Math.abs(pack.includedPostsPerMonth - args.plan.includedPostsPerMonth);
    const campaignsDelta = Math.abs(pack.includedCampaignsPerMonth - args.plan.includedCampaignsPerMonth);
    const score = postsDelta * 2 + campaignsDelta * 3;
    return { pack, score };
  });

  scored.sort((a, b) => a.score - b.score);
  const best = scored[0]?.pack ?? packs[0];
  return { pack: best ?? null, tier: best?.tier ?? null };
}
