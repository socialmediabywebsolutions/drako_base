import type { StripeWebhookAttribution } from "@/lib/billing/stripe-webhook-attribution";

export type StripeWebhookAnomaly = {
  kind: "ATTRIBUTION_MISSING" | "ATTRIBUTION_MISMATCH" | "MAPPING_DRIFT";
  priority: "CRITICAL" | "HIGH";
  title: string;
  description: string;
};

export function deriveStripeWebhookAnomalies(attribution: StripeWebhookAttribution): StripeWebhookAnomaly[] {
  const anomalies: StripeWebhookAnomaly[] = [];
  if (attribution.source === "none") {
    anomalies.push({
      kind: "ATTRIBUTION_MISSING",
      priority: "CRITICAL",
      title: "Billing attribution missing",
      description: "Stripe webhook recibido sin attribution de SaaS/tenant.",
    });
  }
  if (attribution.mismatch) {
    anomalies.push({
      kind: "ATTRIBUTION_MISMATCH",
      priority: "HIGH",
      title: "Billing attribution mismatch",
      description: "Stripe metadata y mapping no coinciden.",
    });
  }
  if (attribution.drift) {
    anomalies.push({
      kind: "MAPPING_DRIFT",
      priority: "HIGH",
      title: "Stripe mapping drift",
      description: "Webhook refiere a Price/Product sin mapping en D1.",
    });
  }
  return anomalies;
}
