"use client";

import { useEffect, useRef, useState } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

type QuestionKey = "gender" | "measurements" | "constitution" | "hair" | "tattoos" | "visualStyle" | "fitness";

const QUESTIONS: Array<{ key: QuestionKey; question: string }> = [
  { key: "gender", question: "¿Eres mujer, hombre, o prefieres no especificarlo?" },
  { key: "measurements", question: "¿Cuánto mides y cuánto pesas aproximadamente?" },
  {
    key: "constitution",
    question:
      "¿Cómo describirías tu constitución física? ¿Eres de las que engorda poco aunque coma mucho, o tienes tendencia a ganar peso fácilmente, o eres más atlética/musculosa por naturaleza?",
  },
  { key: "hair", question: "¿De qué color tienes el cabello y cómo lo llevas normalmente?" },
  { key: "tattoos", question: "¿Tienes tatuajes visibles que aparezcan en tus fotos?" },
  {
    key: "visualStyle",
    question: "¿Cómo describirías el estilo visual de tu contenido — más colorido y vibrante, minimalista, oscuro/misterioso, natural sin filtros?",
  },
  { key: "fitness", question: "¿Cuál es tu estilo fitness principal — gym, yoga, running, lifestyle...?" },
];

type PhysicalProfileAiChatProps = {
  onClose: () => void;
  onFieldsExtracted: (fields: Record<string, unknown>) => Promise<void>;
};

function LoadingDots() {
  return (
    <span className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-violet-400/80"
          style={{ animation: `chat-dot-pulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </span>
  );
}

export default function PhysicalProfileAiChat(props: PhysicalProfileAiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: QUESTIONS[0].question }]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading || done) return;

    const question = QUESTIONS[questionIndex];
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/socialflow/profile/physical/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionKey: question.key, userMessage: text }),
      });
      const json: any = await res.json();
      if (!json.ok) {
        setError(json.message || json.error || "No se pudo procesar la respuesta.");
        return;
      }

      if (json.extractedFields && Object.keys(json.extractedFields).length) {
        await props.onFieldsExtracted(json.extractedFields);
      }

      const nextIndex = questionIndex + 1;
      if (nextIndex < QUESTIONS.length) {
        setQuestionIndex(nextIndex);
        setMessages((prev) => [...prev, { role: "assistant", content: QUESTIONS[nextIndex].question }]);
      } else {
        setDone(true);
        setMessages((prev) => [...prev, { role: "assistant", content: "Perfil completado — revisa los campos y guarda." }]);
      }
    } catch (e: any) {
      setError(e?.message || "Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <style>{`
        @keyframes chat-dot-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d1a] shadow-2xl shadow-violet-900/40">
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(6,182,212,0.15) 100%)" }}
        >
          <div>
            <p className="text-sm font-black text-white">✨ Rellenar perfil físico con IA</p>
            <p className="text-[11px] text-white/40">
              {done ? "Listo — revisa y guarda." : `Pregunta ${questionIndex + 1} de ${QUESTIONS.length}`}
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={[
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user" ? "rounded-br-sm bg-violet-600/80 text-white" : "rounded-bl-sm bg-white/8 text-white/85",
                ].join(" ")}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-start">
              <div className="rounded-2xl rounded-bl-sm bg-white/8 px-3.5 py-2.5">
                <LoadingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {error && <p className="px-5 pb-2 text-xs text-red-300">{error}</p>}
        {done ? (
          <div className="border-t border-white/8 bg-[#0a0a15] px-5 py-3">
            <button
              type="button"
              onClick={props.onClose}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
            >
              Ver perfil físico
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2 border-t border-white/8 bg-[#0a0a15] px-4 py-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              rows={2}
              placeholder="Escribe tu respuesta... (Enter para enviar, Shift+Enter para salto de línea)"
              className="flex-1 resize-none rounded-xl bg-white/8 px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:bg-white/12 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="inline-flex h-9 shrink-0 items-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
            >
              Enviar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
