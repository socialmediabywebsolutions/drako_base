import { getMentoriaOrchestrator } from "@/lib/mentoria/resilience/orchestrator";

let workersStarted = false;

export async function initializeMentoriaWorkers(): Promise<void> {
  if (workersStarted) {
    return;
  }

  try {
    const orchestrator = getMentoriaOrchestrator();
    await orchestrator.startWorkers({
      notificationIntervalMs: 30000,
      feedbackIntervalMs: 60000,
      publishIntervalMs: 45000,
    });
    workersStarted = true;
    console.log("[MentoriaWorkers] Initialized successfully");
  } catch (error) {
    console.error("[MentoriaWorkers] Failed to initialize:", error);
    throw error;
  }
}
