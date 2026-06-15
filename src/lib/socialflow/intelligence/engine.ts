import type { SocialAudit } from "@/lib/socialflow/audit/types";
import type { NewFeedItem } from "@/lib/socialflow/intelligence/repository";

const CRITICAL_AREA_SCORE_THRESHOLD = 40;

// Derives intelligence feed cards from the latest social audit: critical area
// scores become alerts, opportunities become opportunity cards, and the top
// recommendations become recommendation cards. Each item carries a stable
// `source` so re-running the audit updates existing cards instead of duplicating them.
export function buildFeedItemsFromAudit(audit: SocialAudit): NewFeedItem[] {
  const items: NewFeedItem[] = [];

  for (const area of audit.areaScores) {
    if (area.score < CRITICAL_AREA_SCORE_THRESHOLD) {
      items.push({
        type: "alert",
        title: `Area critica: ${area.area}`,
        description: area.notes,
        priority: "high",
        actionLabel: "Ver auditoria",
        actionHref: "/socialflow/audit",
        source: `audit:area:${area.area}`,
      });
    }
  }

  audit.opportunities.forEach((opportunity, index) => {
    items.push({
      type: "opportunity",
      title: "Oportunidad detectada",
      description: opportunity,
      priority: "medium",
      actionLabel: "Ver auditoria",
      actionHref: "/socialflow/audit",
      source: `audit:opportunity:${index}`,
    });
  });

  audit.recommendations.forEach((recommendation, index) => {
    items.push({
      type: "recommendation",
      title: recommendation.title,
      description: recommendation.description,
      priority: recommendation.impact,
      actionLabel: "Ver auditoria",
      actionHref: "/socialflow/audit",
      source: `audit:recommendation:${index}`,
    });
  });

  return items;
}
