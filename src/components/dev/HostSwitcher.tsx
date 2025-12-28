"use client";

import { useEffect, useMemo, useState } from "react";

const OPTIONS = [
  { label: "drako.systems (público)", value: "drako.systems" },
  { label: "base.drako.systems (admin)", value: "base.drako.systems" },
];

function isLocalHost(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

export default function HostSwitcher() {
  const [show, setShow] = useState(false);
  const [currentVirtual, setCurrentVirtual] = useState<string | null>(null);
  const [realHost, setRealHost] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hostname = window.location.hostname;
    setRealHost(window.location.host);
    if (isLocalHost(hostname) && process.env.NODE_ENV !== "production") {
      setShow(true);
      const cookie = document.cookie.split("; ").find((c) => c.startsWith("drako_host="));
      if (cookie) {
        setCurrentVirtual(cookie.split("=")[1]);
      } else {
        setCurrentVirtual("drako.systems");
      }
    }
  }, []);

  const badge = useMemo(() => {
    const label = OPTIONS.find((o) => o.value === currentVirtual)?.label ?? currentVirtual ?? "sin override";
    return `${label} · real: ${realHost}`;
  }, [currentVirtual, realHost]);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      <div className="rounded-2xl bg-black/80 text-white shadow-lg border border-white/10 p-3 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-white/60">Host override (solo local)</p>
        <div className="flex flex-col gap-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`rounded-full px-3 py-1 text-sm border ${
                currentVirtual === opt.value ? "border-emerald-400 text-emerald-200" : "border-white/20 text-white/80"
              }`}
              onClick={() => {
                document.cookie = `drako_host=${opt.value}; path=/; max-age=${60 * 60 * 24 * 7}`;
                window.location.reload();
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-white/60">Actual: {badge}</p>
      </div>
    </div>
  );
}
