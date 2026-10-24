"use client";

import nextDynamic from "next/dynamic";
import { MentoriaWorkspace } from "@/components/mentoria-app/workspace";

const AiHealthBadge = nextDynamic(
  () => import("@/components/mentoria-app/ai-health-badge"),
  { ssr: false },
);

export function MentoriaAppPageClient() {
  return (
    <>
      <MentoriaWorkspace />
      <AiHealthBadge />
    </>
  );
}
