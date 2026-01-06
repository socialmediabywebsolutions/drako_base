import Link from "next/link";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";


export default function BillingSuccessPage() {
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
