export type KeywordMatchType = "exact" | "contains";

export type KeywordDmTrigger = {
  id: string;
  tenantId: string;
  keyword: string;
  matchType: KeywordMatchType;
  dmMessage: string;
  targetPostId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type KeywordDmLogStatus = "SENT" | "FAILED";

export type KeywordDmLogEntry = {
  id: string;
  tenantId: string;
  triggerId: string;
  platformCommentId: string;
  commenterUsername: string | null;
  sentAt: string;
  status: KeywordDmLogStatus;
  errorMessage: string | null;
};
