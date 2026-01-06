import Link from "next/link";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";


export default function BillingCancelPage() {
  return (
    <div className="space-y-6">
      <Card tone="glass" title="Payment cancelled" subtitle="The payment flow was not completed.">
        <p className="text-sm text-[var(--muted)]">You can retry the checkout at any time from the billing section.</p>
        <div className="mt-4">
          <Link href="/billing">
            <Button>Go back to billing</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
