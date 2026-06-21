import type { ChannelKnowledgeSnapshot, ChannelProfile } from "@/lib/socialflow/profile/types";

export type ConversationThreadStatus =
  | "PENDING"
  | "AUTO_APPROVED"
  | "APPROVED"
  | "SENT"
  | "DISMISSED";

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

export type ConversationSettings = {
  tenantId: string;
  saasId: string;
  autoSendEnabled: boolean;
  autoSendProviders: string[];
};

export type ConversationalReplyInput = {
  incomingMessage: string;
  threadType: ConversationThreadType;
  senderName?: string | null;
  profile: ChannelProfile;
  knowledge: ChannelKnowledgeSnapshot;
  tenantId?: string;
  saasId?: string;
};

export type ConversationalReplyOutput = {
  suggestedReply: string;
  aiMetadata: Record<string, unknown>;
};

export type { ChannelKnowledgeSnapshot, ChannelProfile };
