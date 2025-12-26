export type SaasKnowledgeDocumentType = "MANUAL" | "CHECKLIST" | "SCRIPT" | "FAQ" | "TEMPLATE" | "POLICY";

export type SaasKnowledgeDocumentStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export type SaasKnowledgeDocumentSource =
  | "MANUAL_OWNER"
  | "MANUAL_STAFF"
  | "IMPORTED_EMAIL"
  | "IMPORTED_FILE"
  | "SYSTEM";

export type KnowledgeAudience = "OWNER" | "STAFF" | "BOTH";

export type KnowledgeImportance = "INFO" | "STANDARD" | "CRITICAL";

export type SaasKnowledgeLinkTargetType =
  | "SERVICE"
  | "EMPLOYEE"
  | "ROLE"
  | "TASK"
  | "AUTOPILOT_KEY"
  | "BLUEPRINT_PHASE"
  | "SOCIAL_CAMPAIGN";

export type SaasKnowledgeSpace = {
  id: string;
  tenantId: string;
  saasId: string;
  slug: string;
  label: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SaasKnowledgeDocument = {
  id: string;
  tenantId: string;
  saasId: string;
  spaceId?: string | null;
  title: string;
  type: SaasKnowledgeDocumentType;
  source: SaasKnowledgeDocumentSource;
  status: SaasKnowledgeDocumentStatus;
  audience: KnowledgeAudience;
  importance: KnowledgeImportance;
  summary?: string | null;
  content: string;
  tags?: string[] | null;
  createdByEmployeeId?: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown> | null;
};

export type SaasKnowledgeLink = {
  id: string;
  tenantId: string;
  saasId: string;
  documentId: string;
  targetType: SaasKnowledgeLinkTargetType;
  targetId: string;
  createdAt: string;
};

export type CreateKnowledgeSpaceInput = {
  saasId: string;
  slug: string;
  label: string;
  description?: string | null;
  isActive?: boolean;
};

export type CreateKnowledgeDocumentInput = {
  saasId: string;
  spaceId?: string | null;
  title: string;
  type: SaasKnowledgeDocumentType;
  source: SaasKnowledgeDocumentSource;
  status: SaasKnowledgeDocumentStatus;
  audience?: KnowledgeAudience;
  importance?: KnowledgeImportance;
  summary?: string | null;
  content: string;
  tags?: string[] | null;
  createdByEmployeeId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type UpdateKnowledgeDocumentInput = {
  spaceId?: string | null;
  title?: string;
  type?: SaasKnowledgeDocumentType;
  status?: SaasKnowledgeDocumentStatus;
  audience?: KnowledgeAudience;
  importance?: KnowledgeImportance;
  summary?: string | null;
  content?: string;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
};

export type CreateKnowledgeLinkInput = {
  saasId: string;
  documentId: string;
  targetType: SaasKnowledgeLinkTargetType;
  targetId: string;
};

export type LinkedKnowledgeItem = {
  document: SaasKnowledgeDocument;
  space?: SaasKnowledgeSpace | null;
  link?: SaasKnowledgeLink | null;
};

export type KnowledgeSearchParams = {
  spaceId?: string | null;
  status?: SaasKnowledgeDocumentStatus | null;
  tag?: string | null;
  searchQuery?: string | null;
  targetType?: SaasKnowledgeLinkTargetType | null;
  targetId?: string | null;
};
