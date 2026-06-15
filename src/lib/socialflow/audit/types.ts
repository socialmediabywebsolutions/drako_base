export type AuditAreaScore = {
  area: string;
  score: number;
  notes: string;
};

export type AuditRecommendation = {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
};

export type AuditCompetitorComparison = {
  competitor: string;
  comparison: string;
};

export type SocialAudit = {
  id: string;
  tenantId: string;
  saasId: string;
  score: number;
  areaScores: AuditAreaScore[];
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  recommendations: AuditRecommendation[];
  competitorComparison: AuditCompetitorComparison[];
  summary: string;
  createdAt: string;
  updatedAt: string;
};
