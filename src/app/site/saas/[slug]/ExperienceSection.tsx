"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import BookingWidget from "./BookingWidget";
import StyleAdvisorWidget from "./StyleAdvisorWidget";
import type { SaasService } from "@/lib/economy/types";

type ExperienceSectionProps = {
  saasId: string;
  services: SaasService[];
};

export default function ExperienceSection({ saasId, services }: ExperienceSectionProps) {
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const attribution = useMemo(() => {
    const campaignId = searchParams.get("campaignId");
    const postId = searchParams.get("postId");
    const source = searchParams.get("source")?.toLowerCase();
    let sourceChannel: "SOCIAL" | "EMAIL" | "DIRECT" | "REFERRAL" | "OTHER" | null = null;
    if (source === "social") sourceChannel = "SOCIAL";
    else if (source === "email") sourceChannel = "EMAIL";
    else if (source === "referral") sourceChannel = "REFERRAL";
    else if (source === "other") sourceChannel = "OTHER";
    else if (source === "direct") sourceChannel = "DIRECT";
    return { campaignId, postId, sourceChannel };
  }, [searchParams]);

  return (
    <section className="grid gap-6 md:grid-cols-2" id="booking">
      <StyleAdvisorWidget saasId={saasId} onSelectService={(serviceId) => setSelectedServiceId(serviceId)} />
      <div className="rounded-[32px] border border-[#ead2bf] bg-white/80 p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#8a5c3e]">Reserva online</p>
            <h2 className="text-2xl font-semibold">Agenda tu cita ahora</h2>
            <p className="mt-2 text-sm text-[#6b4c3b]">
              Tu solicitud llega a recepción y te confirmamos por WhatsApp o email.
            </p>
          </div>
        </div>
        <div className="mt-6">
          <BookingWidget
            saasId={saasId}
            services={services}
            prefillServiceId={selectedServiceId}
            campaignId={attribution.campaignId}
            postId={attribution.postId}
            sourceChannel={attribution.sourceChannel}
          />
        </div>
      </div>
    </section>
  );
}
