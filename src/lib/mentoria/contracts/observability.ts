import { getMentoriaOrchestrator } from "@/lib/mentoria/resilience/orchestrator";

export type MentoriaOperatorSystemHealth = {
  notifications: { pending: number; failed: number; abandoned: number; total: number };
  feedback: { pending: number; failed: number; total: number };
  publishes: { pending: number; failed: number; abandoned: number; total: number };
  criticalEvents: number;
  silence: {
    studentsWithoutRecentFeedback: number;
    studentsWithoutRecentParentNotification: number;
    studentsWithoutRecentAcademicActivity: number;
  };
};

export async function getMentoriaOperatorSystemHealth(input: {
  tenantId: string;
}): Promise<MentoriaOperatorSystemHealth> {
  const tenantId = input.tenantId.trim();
  if (!tenantId) throw new Error("MENTORIA_OBSERVABILITY_TENANT_REQUIRED");

  return getMentoriaOrchestrator().getHealthStatus(tenantId);
}
