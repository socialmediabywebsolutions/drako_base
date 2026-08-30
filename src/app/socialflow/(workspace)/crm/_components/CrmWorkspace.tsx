"use client";

import { useState } from "react";
import type { ConversationSettings, ConversationThread } from "@/lib/socialflow/conversational/types";
import type { LeadTemperature, SocialFlowLead } from "@/lib/socialflow/leads/types";
import ConversationInbox from "@/components/socialflow/conversation-inbox";
import LeadsPanel from "@/components/socialflow/leads-panel";
import IntelligenceFeedPanel from "../../_components/IntelligenceFeedPanel";
import StrategicPlanCard from "../../_components/StrategicPlanCard";

type CrmTab = "comunidad" | "leads" | "inteligencia";

type Props = {
  initialTab: CrmTab;
  saasId: string;
  threads: ConversationThread[];
  settings: ConversationSettings;
  leadTemperatureByThreadId: Record<string, LeadTemperature>;
  leads: SocialFlowLead[];
  accountType: "influencer" | "empresa" | null;
};

const TABS: { id: CrmTab; label: string }[] = [
  { id: "comunidad", label: "Comunidad" },
  { id: "leads", label: "Leads" },
  { id: "inteligencia", label: "Inteligencia" },
];

export default function CrmWorkspace({
  initialTab,
  saasId,
  threads,
  settings,
  leadTemperatureByThreadId,
  leads,
  accountType,
}: Props) {
  const [tab, setTab] = useState<CrmTab>(initialTab);

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-xl border border-white/8 bg-white/4 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              "flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
              tab === t.id ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/70",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "comunidad" && (
        <ConversationInbox
          threads={threads}
          settings={settings}
          saasId={saasId}
          leadTemperatureByThreadId={leadTemperatureByThreadId}
        />
      )}
      {tab === "leads" && <LeadsPanel leads={leads} saasId={saasId} accountType={accountType} />}
      {tab === "inteligencia" && (
        <div className="space-y-5">
          <StrategicPlanCard saasId={saasId} />
          <IntelligenceFeedPanel />
        </div>
      )}
    </div>
  );
}
