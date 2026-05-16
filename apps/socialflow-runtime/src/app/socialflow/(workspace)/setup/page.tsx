import RuntimeBoundaryNotice from "../_components/runtime-boundary-notice";

export default function SocialFlowSetupPage() {
  return (
    <RuntimeBoundaryNotice
      title="Setup is not wired in the isolated SocialFlow runtime"
      description="The previous setup flow used shared orchestration and dossier infrastructure outside the SocialFlow product boundary."
      details="This route stays disabled until SocialFlow has a dedicated setup workflow that persists and reads product data from its own runtime and canonical `/api/socialflow/*` APIs."
    />
  );
}
