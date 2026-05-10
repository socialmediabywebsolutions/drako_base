import RuntimeBoundaryNotice from "@/app/socialflow/(workspace)/_components/runtime-boundary-notice";

export default function SocialFlowPlanPage() {
  return (
    <RuntimeBoundaryNotice
      title="Planning is not wired in the isolated SocialFlow runtime"
      description="The old planning page was coupled to blueprint-generation flows outside the SocialFlow product boundary."
      details="This route now fails closed instead of loading cross-runtime product logic. Re-enable it only after a SocialFlow-native planning workflow exists behind `/api/socialflow/*`."
    />
  );
}
