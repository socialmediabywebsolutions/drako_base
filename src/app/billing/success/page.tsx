"use client";

import Link from "next/link";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { useEffect } from "react";
import { trackGrowthEventClient } from "@/lib/saas/growth/client";

export default function BillingSuccessPage() {
  useEffect(() => {
    // Track conversion on mount (Client-side)
    trackGrowthEventClient({
      tenantId: "mentoria_ia", // Context-aware in real app, hardcoded fallback for V1
      eventName: "mentoria.converted",
      country: "OTHER",
      payload: {
        source: "stripe_success_page",
        isFastConverter: true
      }
    });
  }, []);

  return (
    <div className="space-y-6">
      <Card tone="glass" title="Subscription activated" subtitle="If the payment was processed, your plan is now active.">
        <p className="text-sm text-[var(--muted)]">You can return to the billing center to review the current status.</p>
        <div className="mt-4 flex gap-3">
          <Link href="/billing">
            <Button>Go to billing</Button>
          </Link>
          <Link href="/admin">
            <Button variant="outline">Go to dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
