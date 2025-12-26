export type ConversationChannel =
  | "WHATSAPP"
  | "INSTAGRAM_DM"
  | "MESSENGER"
  | "EMAIL"
  | "PHONE_CALL"
  | "IN_PERSON"
  | "OTHER";

export type ConversationType = "LEAD" | "SUPPLIER" | "CLIENT" | "INTERNAL" | "TASK" | "OTHER";

export type ConversationSource =
  | "EMAIL"
  | "WHATSAPP"
  | "INSTAGRAM_DM"
  | "SOCIAL"
  | "TASK"
  | "PORTAL"
  | "MANUAL"
  | "SYSTEM"
  | "OTHER";

export type ConversationActorType = "OWNER" | "EMPLOYEE";

export interface ConversationParticipants {
  owners?: boolean;
  employeeIds?: string[];
}

export interface ConversationLinkedEntity {
  type: string;
  id: string;
  label?: string;
}

export type ConversationMetadata = {
  type?: ConversationType | null;
  source?: ConversationSource | null;
  tags?: string[] | null;
  participants?: ConversationParticipants | null;
  linkedEntities?: ConversationLinkedEntity[] | null;
  emailMessageIds?: string[] | null;
  lastActorReadAt?: Record<string, string> | null;
} & Record<string, unknown>;

export type ConversationStatus = "OPEN" | "PENDING" | "RESOLVED" | "ARCHIVED";

export interface SaasConversation {
  id: string;
  tenantId: string;
  saasId: string;
  customerId: string | null;
  channel: ConversationChannel;
  subject: string | null;
  status: ConversationStatus;
  lastMessageAt: string | null;
  lastCustomerMessageAt: string | null;
  lastStaffMessageAt: string | null;
  metadata: ConversationMetadata | null;
  createdAt: string;
  updatedAt: string;
}

export type ConversationSenderType = "CUSTOMER" | "STAFF" | "SYSTEM";

export type ConversationDirection = "INBOUND" | "OUTBOUND";

export interface SaasConversationMessage {
  id: string;
  tenantId: string;
  saasId: string;
  conversationId: string;
  customerId: string | null;
  employeeId: string | null;
  senderType: ConversationSenderType;
  direction: ConversationDirection;
  body: string;
  providerMessageId: string | null;
  createdAt: string;
}

export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL";

export type NotificationType =
  | "CONVERSATION_NEW_MESSAGE"
  | "EMAIL_LEAD"
  | "EMAIL_SUPPLIER_SAVINGS"
  | "APPOINTMENT_GUARDRAIL_WARN"
  | "TASK_ASSIGNED"
  | "SOCIAL_CAMPAIGN_ALERT"
  | "SYSTEM";

export interface SaasNotification {
  id: string;
  tenantId: string;
  saasId: string | null;
  employeeId: string | null;
  type: NotificationType;
  severity: NotificationSeverity;
  title: string;
  body: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface ConversationListItem {
  conversation: SaasConversation;
  customerSummary?: {
    id: string;
    name: string;
    lastVisitAt?: string;
    preferredEmployeeName?: string;
  };
  lastMessagePreview: string;
  unreadCount: number;
  type?: ConversationType | null;
  source?: ConversationSource | null;
  tags?: string[];
  linkedEntities?: ConversationLinkedEntity[];
  unreadNotificationsCount?: number;
}

export interface ConversationListActorItem extends ConversationListItem {
  unreadForActor: boolean;
  unreadCountForActor: number;
  lastActorReadAt: string | null;
}

export interface ConversationActorMessage {
  message: SaasConversationMessage;
  conversation: SaasConversation;
  unreadCountForActor: number;
}
