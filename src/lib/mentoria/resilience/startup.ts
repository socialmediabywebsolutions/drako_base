import { getMentoriaOrchestrator } from "@/lib/mentoria/resilience/orchestrator";
import { isDatabaseAvailable } from "@/lib/db";

let workersStarted = false;

export async function initializeMentoriaWorkers(): Promise<void> {
  if (workersStarted) {
    return;
  }

  // Skip initialization if DB bindings are not available (e.g., in local dev without wrangler)
  if (!isDatabaseAvailable()) {
    console.warn("[MentoriaWorkers] Skipping initialization: DB bindings not available (expected in local dev)");
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
    // Don't throw - allow app to continue without workers
    console.warn("[MentoriaWorkers] Continuing without workers");
  }
}
