import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { resolveSocialContext } from "@/lib/socialflow/repository";
import {
  getConversationSettings,
  listConversationThreads,
} from "@/lib/socialflow/conversational/repository";
import { listLeadTemperatureByThreadId, listLeads } from "@/lib/socialflow/leads/repository";
import CrmWorkspace from "./_components/CrmWorkspace";

const SAAS_ID = "socialflow";

type CrmTab = "comunidad" | "leads" | "inteligencia";

function normalizeTab(value: string | undefined): CrmTab {
  return value === "leads" || value === "inteligencia" ? value : "comunidad";
}

export default async function SocialFlowCrmPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const resolvedSearch = searchParams ? await searchParams : undefined;
  const initialTab = normalizeTab(resolvedSearch?.tab);

  const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: SAAS_ID });
  const [threads, settings, leadTemperatureByThreadId, leads] = await Promise.all([
    listConversationThreads(ctx, { limit: 50 }),
    getConversationSettings(ctx),
    listLeadTemperatureByThreadId(ctx).catch(() => new Map<string, "HOT" | "WARM" | "COLD">()),
    listLeads(ctx, { limit: 100 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#3b82f6]">
          Socialcors · CRM Social
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">
          CRM Social
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Comunidad, leads e inteligencia accionable en un solo lugar.
        </p>
      </div>

      <CrmWorkspace
        initialTab={initialTab}
        saasId={SAAS_ID}
        threads={threads}
        settings={settings}
        leadTemperatureByThreadId={Object.fromEntries(leadTemperatureByThreadId)}
        leads={leads}
        accountType={session.accountType}
      />
    </div>
  );
}
