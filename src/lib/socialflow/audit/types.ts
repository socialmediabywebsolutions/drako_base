export type AuditAreaScore = {
  area: string;
  score: number;
  notes: string;
};

export type AuditRecommendation = {
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  how?: string[];
};

export type AuditCompetitorComparison = {
  competitor: string;
  comparison: string;
  followers?: number | null;
  engagementRate?: string | null;
  postingFrequency?: string | null;
  vsAccount?: { direction: "up" | "down" | "equal"; diff: string } | null;
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
