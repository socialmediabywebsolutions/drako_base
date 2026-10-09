import { redirect } from "next/navigation";

export default function SocialFlowLeadsRedirect() {
  redirect("/socialflow/crm?tab=leads");
}
