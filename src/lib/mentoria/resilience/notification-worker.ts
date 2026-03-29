import { NotificationQueueManager } from "@/lib/mentoria/resilience/notification-queue";
import { sendWhatsAppMessage } from "@/connectors/whatsapp/client";

export class NotificationWorker {
  private queueManager: NotificationQueueManager;

  constructor() {
    this.queueManager = new NotificationQueueManager();
  }

  async processQueue(): Promise<{ processed: number; delivered: number; failed: number }> {
    const jobs = await this.queueManager.getPendingJobs(10);
    let delivered = 0;
    let failed = 0;

    for (const job of jobs) {
      await this.queueManager.markProcessing(job.id, job.tenantId);

      try {
        const result = await sendWhatsAppMessage(job.parentPhone, job.message);

        if (result.success && result.messageId) {
          await this.queueManager.markDelivered(job.id, job.tenantId, result.messageId);
          delivered++;
        } else {
          await this.queueManager.markFailed(job.id, job.tenantId, result.error || "Unknown error");
          failed++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.queueManager.markFailed(job.id, job.tenantId, errorMessage);
        failed++;
      }
    }

    return {
      processed: jobs.length,
      delivered,
      failed,
    };
  }
}

export async function startNotificationWorker(intervalMs: number = 30000): Promise<void> {
  const worker = new NotificationWorker();

  setInterval(async () => {
    try {
      const result = await worker.processQueue();
      if (result.delivered > 0 || result.failed > 0) {
        console.log("[NotificationWorker] Processed:", result);
      }
    } catch (error) {
      console.error("[NotificationWorker] Error:", error);
    }
  }, intervalMs);
}
