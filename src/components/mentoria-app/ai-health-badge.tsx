"use client";

import { useEffect, useState } from "react";

type AiHealth = {
  status: "healthy" | "unhealthy";
  error?: string;
  hint?: string;
};

export default function MentoriaAiHealthBadge() {
  const [health, setHealth] = useState<AiHealth | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch("/api/mentoria/health/ai", { cache: "no-store", signal: controller.signal });
        const body = (await res.json()) as Partial<AiHealth>;
        if (!active) return;
        const normalized: AiHealth = {
          status: (body.status as AiHealth["status"]) ?? "unhealthy",
          error: typeof body.error === "string" ? body.error : undefined,
          hint: typeof body.hint === "string" ? body.hint : undefined,
        };
        setHealth(normalized);
      } catch {
        if (!active) return;
        setHealth({ status: "unhealthy", error: "MENTORIA_AI_HEALTHCHECK_FAILED" });
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  if (!health || health.status === "healthy") return null;
  if (health.error !== "MENTORIA_AI_NOT_AVAILABLE" && health.error !== "AI_BINDING_MISSING") return null;

  const title = health.hint || "Workers AI no disponible en local";

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 select-none text-xs">
      <span
        className="pointer-events-auto rounded-full border border-amber-300 bg-amber-50/85 px-3 py-1 text-amber-900 shadow-sm backdrop-blur hover:bg-amber-100"
        title={title}
      >
        AI off (local)
      </span>
    </div>
  );
}
