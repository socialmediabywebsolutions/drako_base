"use client";

import dynamic from "next/dynamic";
import { MentoriaWorkspace } from "@/components/mentoria-app/workspace";

export const dynamic = "force-dynamic";

const AiHealthBadge = dynamic(
  () => import("@/components/mentoria-app/ai-health-badge"),
  { ssr: false },
);

export default function MentoriaAppPage() {
  return (
    <>
      <MentoriaWorkspace />
      <AiHealthBadge />
    </>
  );
}