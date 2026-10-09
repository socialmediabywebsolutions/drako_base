import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { listKnowledgeDocs } from "@/lib/socialflow/knowledge/repository";
import { getChannelProfile } from "@/lib/socialflow/profile/repository";
import { calculateBrainScore } from "@/lib/socialflow/knowledge/brain-score";
import KnowledgeBaseClient from "./knowledge-client";

const SAAS_ID = "socialflow";

export default async function KnowledgeBasePage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const [docs, profile] = await Promise.all([
    listKnowledgeDocs(session.tenantId, SAAS_ID),
    getChannelProfile(session.tenantId, SAAS_ID),
  ]);
  const score = calculateBrainScore({ docs, profile });

  return <KnowledgeBaseClient accountType={session.accountType} score={score} />;
}
