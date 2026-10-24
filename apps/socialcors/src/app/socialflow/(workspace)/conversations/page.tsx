import { redirect } from "next/navigation";

export default function SocialFlowConversationsRedirect() {
  redirect("/socialflow/crm?tab=comunidad");
}
