export type WhatsappActorType = "PLATFORM_OWNER" | "SAAS_OWNER" | "EMPLOYEE" | "CUSTOMER";

export type WhatsappIdentity = {
  id: string;
  tenantId: string;
  saasId: string;
  actorType: WhatsappActorType;
  actorId: string;
  phoneNumber: string;
  preferredLanguage: string | null;
  allowedChannels: string[] | null;
  consentFlags: string[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type WhatsappMessage = {
  id: string;
  tenantId: string;
  saasId: string;
  phoneNumber: string;
  direction: "INBOUND" | "OUTBOUND";
  actorType: WhatsappActorType | null;
  actorId: string | null;
  conversationId: string | null;
  body: string;
  intent: WhatsappIntent | null;
  status: "RECEIVED" | "PROCESSED" | "SENT" | "FAILED";
  providerMessageId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export type WhatsappIntent =
  | "SHOW_MENU"
  | "SHOW_APPOINTMENTS_TODAY"
  | "CONFIRM_NEXT_APPOINTMENT"
  | "REQUEST_RESCHEDULE"
  | "SHOW_TODAY_SCHEDULE"
  | "SHOW_TODAY_TASKS"
  | "SHOW_TODAY_PLAYBOOKS"
  | "SHOW_DAILY_SUMMARY"
  | "SHOW_OPEN_TASKS"
  | "SHOW_TAX_SUMMARY"
  | "CUSTOMER_NEXT_APPOINTMENT"
  | "CUSTOMER_TODAY_APPOINTMENTS"
  | "CUSTOMER_CONFIRM_APPOINTMENT"
  | "CUSTOMER_CANCEL_APPOINTMENT"
  | "EMPLOYEE_TODAY_SCHEDULE"
  | "EMPLOYEE_WEEK_SCHEDULE"
  | "EMPLOYEE_TODAY_TASKS"
  | "OWNER_DAILY_SUMMARY"
  | "OWNER_PORTFOLIO_SUMMARY"
  | "OWNER_TAX_OVERVIEW"
  | "OWNER_TASKS_TODAY"
  | "OWNER_RISKS"
  | "OWNER_PACKS_OPPORTUNITIES"
  | "OWNER_VENDOR_SUMMARY"
  | "OWNER_BASELINE_STATUS"
  | "OWNER_TREASURY_STATUS"
  | "OWNER_SPENDING_ROOM"
  | "OWNER_MARKETING_SUMMARY"
  | "OWNER_DEPARTMENT_COVERAGE_SUMMARY"
  | "OWNER_SAAS_HEALTH_SUMMARY"
  | "UNKNOWN";

export type WhatsappIncomingPayload = {
  tenantId: string;
  saasId: string;
  phoneNumber: string;
  body: string;
  metadata?: Record<string, unknown> | null;
};

export type WhatsappAutomationMessage = {
  body: string;
  intent?: WhatsappIntent | null;
  actorType?: WhatsappActorType | null;
  actorId?: string | null;
};

export type WhatsappAutomationResult = {
  messagesToSend: WhatsappAutomationMessage[];
  linkedConversationId?: string | null;
  intents: WhatsappIntent[];
};

export type WhatsappActorIdentity = {
  actorType: WhatsappActorType;
  actorId: string;
  phoneNumber: string;
  preferredLanguage?: string | null;
  allowedChannels?: string[] | null;
  consentFlags?: string[] | null;
  metadata?: Record<string, unknown> | null;
};
