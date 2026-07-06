import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import KnowledgeBaseClient from "./knowledge-client";

export default async function KnowledgeBasePage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  return <KnowledgeBaseClient accountType={session.accountType} />;
}
