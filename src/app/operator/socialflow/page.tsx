import SocialAutomationControl from "@/components/operator/SocialAutomationControl";
import SocialflowOperatorDashboard from "./_components/SocialflowOperatorDashboard";

export const dynamic = "force-dynamic";

export default function OperatorSocialFlowPage() {
  return (
    <div className="space-y-8">
      <SocialflowOperatorDashboard />
      <SocialAutomationControl />
    </div>
  );
}
