// Planes del CRM de /operator/socialflow ("＋ Crear venta"). Los usan /api/clients (POST
// con plan) y /api/operator/crm (MRR estimado).
export const CRM_PLANS = {
  starter: { label: "Starter", monthly: 29 },
  pro: { label: "Pro", monthly: 79 },
  business: { label: "Business", monthly: 199 },
} as const;

export type CrmPlan = keyof typeof CRM_PLANS;

export function isCrmPlan(value: unknown): value is CrmPlan {
  return typeof value === "string" && value in CRM_PLANS;
}

export function crmPlanPrice(plan: string | null | undefined): number {
  const key = plan?.toLowerCase();
  return isCrmPlan(key) ? CRM_PLANS[key].monthly : 0;
}
