export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { env as resolveEnv } from "@/lib/cf";
import { isProductionEnvironment } from "@/lib/security/production-gate";
import { POST as canonicalStripeWebhookPost } from "@/app/api/stripe/webhook/route";

export async function POST(request: Request) {
  if (isProductionEnvironment(resolveEnv())) {
    return NextResponse.json(
      {
        ok: false,
        code: "LEGACY_BILLING_WEBHOOK_BLOCKED",
        message: "Legacy /api/billing/webhook is blocked in production. Use /api/stripe/webhook.",
      },
      { status: 410 },
    );
  }

  return canonicalStripeWebhookPost(request);
}
