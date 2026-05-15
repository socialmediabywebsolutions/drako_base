import type { ReactNode } from "react";
import { initializeMentoriaWorkers } from "@/lib/mentoria/resilience/startup";

export default async function MentoriaLayout({ children }: { children: ReactNode }) {
  try {
    await initializeMentoriaWorkers();
  } catch (error) {
    console.error("[MentoriaLayout] Failed to initialize Mentoria workers:", error);
  }

  return children;
}
