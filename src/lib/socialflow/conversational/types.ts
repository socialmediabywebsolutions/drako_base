import type { ChannelKnowledgeSnapshot, ChannelProfile } from "@/lib/socialflow/profile/types";

export type ConversationThreadStatus =
  | "PENDING"
  | "AUTO_APPROVED"
  | "APPROVED"
  | "SENT"
  | "DISMISSED"
  | "NEEDS_HUMAN"
  | "DELIVERY_FAILED";

export type ConversationThreadType = "DM" | "COMMENT";

export type ConversationThread = {
  id: string;
  tenantId: string;
  saasId: string;
  provider: string;
  threadType: ConversationThreadType;
  platformThreadId: string | null;
  senderName: string | null;
  senderHandle: string | null;
  incomingMessage: string;
  contextPostId: string | null;
  suggestedReply: string | null;
  finalReply: string | null;
  status: ConversationThreadStatus;
  aiMetadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type ActiveHoursDay = {
  active: boolean;
  from: string; // "HH:MM", 24h local al timezone configurado
  to: string;   // "HH:MM"
};

export type ActiveHoursConfig = {
  enabled: boolean;
  timezone: string; // IANA, ej. "Europe/Madrid"
  schedule: {
    monday: ActiveHoursDay;
    tuesday: ActiveHoursDay;
    wednesday: ActiveHoursDay;
    thursday: ActiveHoursDay;
    friday: ActiveHoursDay;
    saturday: ActiveHoursDay;
    sunday: ActiveHoursDay;
  };
  outside_hours_message: string | null;
};

export type ConversationSettings = {
  tenantId: string;
  saasId: string;
  autoSendEnabled: boolean;
  autoSendProviders: string[];
  // NULL = sin configurar → el agente responde 24/7 (comportamiento actual, sin cambios).
  activeHoursJson: string | null;
};

export type ConversationalReplyInput = {
  incomingMessage: string;
  threadType: ConversationThreadType;
  // Canal real (INSTAGRAM/FACEBOOK_PAGE/LINKEDIN) — buildSystemPrompt() lo sustituye
  // literalmente en la REGLA CRÍTICA DE CANAL para que la IA nunca invente contexto
  // de canal (p. ej. decir "cuéntame en los comentarios" dentro de un DM).
  provider: string;
  senderName?: string | null;
  profile: ChannelProfile;
  knowledge: ChannelKnowledgeSnapshot;
  knowledgeContext?: string;
  tenantId?: string;
  saasId?: string;
};

export type ConversationalReplyOutput = {
  suggestedReply: string;
  aiMetadata: Record<string, unknown>;
};

export type { ChannelKnowledgeSnapshot, ChannelProfile };
