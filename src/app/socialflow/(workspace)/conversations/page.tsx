import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import {
  getConversationSettings,
  listConversationThreads,
  resolveSocialContext,
} from "@/lib/socialflow/conversational/repository";
import { listHotLeadThreadIds } from "@/lib/socialflow/leads/repository";
import ConversationInbox from "@/components/socialflow/conversation-inbox";

const SAAS_ID = "socialflow";

export default async function SocialFlowConversationsPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: SAAS_ID });
  const [threads, settings, hotLeadThreadIds] = await Promise.all([
    listConversationThreads(ctx, { limit: 50 }),
    getConversationSettings(ctx),
    listHotLeadThreadIds(ctx).catch(() => new Set<string>()),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">
          Socialcors · Conversaciones
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
          Mi Comunidad
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
          Gestiona comentarios y DMs de tus seguidores. La IA responde con tu voz usando tu base de conocimiento.
        </p>
      </div>

      <ConversationInbox threads={threads} settings={settings} saasId={SAAS_ID} hotLeadThreadIds={[...hotLeadThreadIds]} />
    </div>
  );
}
