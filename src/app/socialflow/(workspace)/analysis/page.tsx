import RuntimeBoundaryNotice from "@/app/socialflow/(workspace)/_components/runtime-boundary-notice";

export default function SocialFlowAnalysisPage() {
  return (
    <RuntimeBoundaryNotice
      title="Analysis is not wired in the isolated SocialFlow runtime"
      description="The previous analysis route depended on orchestration flows outside the product runtime."
      details="This route remains intentionally unavailable until SocialFlow has a product-native analysis flow that does not depend on Campamento Base or shared blueprint tooling."
    />
  );
}
