export type LeadTemperature = "HOT" | "WARM" | "COLD";
export type LeadStatus = "NEW" | "CONTACTED" | "CONVERTED" | "LOST";

export type SocialFlowLead = {
  id: string;
  tenantId: string;
  saasId: string;
  threadId: string;
  provider: string;
  senderName: string | null;
  senderHandle: string | null;
  incomingMessage: string;
  intentScore: number;
  temperature: LeadTemperature;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
};

export type LeadDetectionResult = {
  isLead: boolean;
  intentScore: number;
  temperature: LeadTemperature | null;
};
