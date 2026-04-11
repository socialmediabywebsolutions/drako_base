"use client";
import { MentoriaWorkspace } from "@/components/mentoria-app/workspace";
import NextDynamic from "next/dynamic";

export const dynamic = "force-dynamic";

export default function MentoriaAppPage() {
  const AiHealthBadge = NextDynamic(() => import("@/components/mentoria-app/ai-health-badge"), { ssr: false });
  return (
    <>
      <MentoriaWorkspace />
      <AiHealthBadge />
    </>
  );
}
