export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { MentoriaService } from "@/lib/mentoria/service";
import { TrialManager } from "@/lib/mentoria/trial-system";
import { buildUpgradePrompt, buildTrialExpiringWarning } from "@/lib/mentoria/upgrade-flow";

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const service = new MentoriaService();
    const trialManager = new TrialManager();

    const student = await service.requireOnboardedStudent(actor);
    const billing = await service.getBillingSummary(
      { tenantId: actor.tenantId, canManageBilling: true },
      student
    );

    const isTrialActive = await trialManager.isTrialActive(actor.tenantId, student.id);
    const daysRemaining = await trialManager.getTrialDaysRemaining(actor.tenantId, student.id);

    let upgradePrompt = null;
    let trialWarning = null;

    if (!isTrialActive && billing.planCode === "free") {
      upgradePrompt = buildUpgradePrompt({
        reason: "trial_expired",
        upgradeUrl: `/upgrade?tenant=${actor.tenantId}`,
      });
    }

    if (isTrialActive && daysRemaining <= 3) {
      trialWarning = buildTrialExpiringWarning(daysRemaining);
    }

    return NextResponse.json({
      ok: true,
      trial: {
        isActive: isTrialActive,
        daysRemaining,
      },
      billing: {
        planCode: billing.planCode,
        limits: billing.limits,
        usage: billing.usage,
      },
      upgradePrompt,
      trialWarning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UPGRADE_STATUS_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : 500;
    console.error("[UpgradeAPI] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const body = (await request.json()) as { action: string };

    if (body.action === "convert_trial") {
      const trialManager = new TrialManager();
      const service = new MentoriaService();
      const student = await service.requireOnboardedStudent(actor);

      await trialManager.convertTrial(actor.tenantId, student.id);

      return NextResponse.json({
        ok: true,
        message: "Trial converted to paid subscription",
      });
    }

    return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UPGRADE_ACTION_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : 500;
    console.error("[UpgradeAPI] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
