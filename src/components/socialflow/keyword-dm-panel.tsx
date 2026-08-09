"use client";

import { useEffect, useState, useTransition } from "react";
import type { KeywordDmTrigger, KeywordMatchType } from "@/lib/socialflow/keyword-dm/types";

type Props = {
  saasId: string;
};

export default function KeywordDmAutomationPanel({ saasId }: Props) {
  const [triggers, setTriggers] = useState<KeywordDmTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [matchType, setMatchType] = useState<KeywordMatchType>("contains");
  const [dmMessage, setDmMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [isPendingCreate, startCreateTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPendingAction, startActionTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/socialflow/keyword-triggers?saasId=${encodeURIComponent(saasId)}`);
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          triggers?: KeywordDmTrigger[];
          error?: string;
        };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to load triggers");
        if (!cancelled) setTriggers(data.triggers ?? []);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Error al cargar palabras clave");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [saasId]);

  function createTrigger() {
    if (!keyword.trim() || !dmMessage.trim()) return;
    setFormError(null);
    startCreateTransition(async () => {
      try {
        const res = await fetch("/api/socialflow/keyword-triggers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saasId, keyword: keyword.trim(), matchType, dmMessage: dmMessage.trim() }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          trigger?: KeywordDmTrigger;
          error?: string;
        };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to create trigger");
        if (data.trigger) {
          setTriggers((prev) => [data.trigger!, ...prev]);
          setKeyword("");
          setDmMessage("");
          setMatchType("contains");
        }
      } catch (e) {
        setFormError(e instanceof Error ? e.message : "Error al crear la palabra clave");
      }
    });
  }

  function toggleActive(trigger: KeywordDmTrigger) {
    setPendingId(trigger.id);
    startActionTransition(async () => {
      try {
        const res = await fetch(`/api/socialflow/keyword-triggers/${trigger.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saasId, active: !trigger.active }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          trigger?: KeywordDmTrigger;
          error?: string;
        };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to update trigger");
        if (data.trigger) setTriggers((prev) => prev.map((t) => (t.id === trigger.id ? data.trigger! : t)));
      } finally {
        setPendingId(null);
      }
    });
  }

  function deleteTrigger(trigger: KeywordDmTrigger) {
    setPendingId(trigger.id);
    startActionTransition(async () => {
      try {
        const res = await fetch(`/api/socialflow/keyword-triggers/${trigger.id}?saasId=${encodeURIComponent(saasId)}`, {
          method: "DELETE",
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to delete trigger");
        setTriggers((prev) => prev.filter((t) => t.id !== trigger.id));
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-white/8 bg-white/4 p-5">
        <p className="text-sm font-semibold text-white">Nueva palabra clave</p>
        <p className="text-xs text-white/40">
          Cuando alguien comente esta palabra en cualquiera de tus posts, le enviamos automáticamente un DM
          privado (respuesta privada al comentario). Aplica a todos tus posts.
        </p>

        <div className="flex gap-2">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Ej: RECETA"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
          />
          <select
            value={matchType}
            onChange={(e) => setMatchType(e.target.value as KeywordMatchType)}
            className="rounded-lg border border-white/10 bg-[#0d0d1e] px-2 py-2 text-sm text-white/70 focus:outline-none"
          >
            <option value="contains">Contiene</option>
            <option value="exact">Exacto</option>
          </select>
        </div>

        <textarea
          value={dmMessage}
          onChange={(e) => setDmMessage(e.target.value)}
          placeholder="Mensaje que recibirá por DM…"
          rows={3}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
        />

        {formError && <p className="text-xs text-red-400">{formError}</p>}

        <Btn onClick={createTrigger} disabled={isPendingCreate || !keyword.trim() || !dmMessage.trim()} variant="primary">
          {isPendingCreate ? "Creando…" : "Crear palabra clave"}
        </Btn>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="py-8 text-center text-sm text-white/35">Cargando…</p>
        ) : loadError ? (
          <p className="py-8 text-center text-sm text-red-400">{loadError}</p>
        ) : triggers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 py-12 text-center">
            <p className="text-sm text-white/35">Aún no tienes palabras clave configuradas.</p>
          </div>
        ) : (
          triggers.map((trigger) => (
            <div key={trigger.id} className="space-y-2 rounded-xl border border-white/8 bg-white/4 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">{trigger.keyword}</span>
                <span className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] font-medium text-white/50">
                  {trigger.matchType === "exact" ? "Exacto" : "Contiene"}
                </span>
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    trigger.active ? "bg-emerald-500/15 text-emerald-300" : "bg-white/8 text-white/40",
                  ].join(" ")}
                >
                  {trigger.active ? "Activo" : "Pausado"}
                </span>
                <span className="ml-auto text-[11px] text-white/25">
                  {trigger.targetPostId ? "Post específico" : "Todos los posts"}
                </span>
              </div>
              <p className="whitespace-pre-wrap rounded-lg bg-white/5 px-3 py-2 text-sm text-white/60">
                {trigger.dmMessage}
              </p>
              <div className="flex gap-2">
                <Btn
                  onClick={() => toggleActive(trigger)}
                  disabled={isPendingAction && pendingId === trigger.id}
                  variant="secondary"
                >
                  {trigger.active ? "Desactivar" : "Activar"}
                </Btn>
                <Btn onClick={() => deleteTrigger(trigger)} disabled={isPendingAction && pendingId === trigger.id} variant="ghost">
                  Borrar
                </Btn>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  variant,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant: "primary" | "secondary" | "ghost";
}) {
  const cls = {
    primary:
      "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/20 hover:brightness-110",
    secondary: "border border-white/10 bg-white/6 text-white/70 hover:bg-white/10 hover:text-white",
    ghost: "text-white/35 hover:text-white/60 hover:bg-white/6",
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={["rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-40", cls].join(" ")}
    >
      {children}
    </button>
  );
}
