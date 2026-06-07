import type {
  SocialAutomationHistoryRun,
  SocialAutomationHistoryStatus,
} from "@/lib/campamento-base/social-automation-history";

export * from "@/lib/campamento-base/social-automation-history";

export type CampoBaseSocialAutomationRun = Omit<
  SocialAutomationHistoryRun,
  "status" | "completedAt" | "result" | "error"
> & {
  status: Extract<SocialAutomationHistoryStatus, "SUCCESS" | "FAILED">;
  campaignId: string | null;
  postsCount: number;
  scheduledCount: number;
  error: string | null;
  finishedAt: string;
};
