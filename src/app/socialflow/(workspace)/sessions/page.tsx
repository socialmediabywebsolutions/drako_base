import RuntimeBoundaryNotice from "@/app/socialflow/(workspace)/_components/runtime-boundary-notice";

export default function SocialFlowSessionsPage() {
  return (
    <RuntimeBoundaryNotice
      title="Sessions is not part of the isolated SocialFlow runtime"
      description="The old sessions page depended on Mentoría components and another SaaS API surface."
      details="This route now stops at the boundary instead of calling another SaaS runtime. Add it back only with SocialFlow-native usage and billing contracts."
    />
  );
}
