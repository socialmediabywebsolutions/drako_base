"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const WELCOME: ChatMessage = {
  role: "assistant",
  content: "¡Hola! Soy Flow 👋 ¿Eres creador de contenido o tienes un negocio?",
};

function detectCta(reply: string): "influencer" | "empresa" | null {
  const lower = reply.toLowerCase();
  if (!lower.includes("registro")) return null;
  if (lower.includes("influencer") || lower.includes("creador")) return "influencer";
  if (lower.includes("empresa") || lower.includes("negocio") || lower.includes("agencia")) return "empresa";
  return null;
}

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

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [isOpen, messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const history = messages.slice(1);

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/socialflow/public/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });
      const data = (await res.json()) as { ok: boolean; reply?: string };
      const reply = data.reply ?? "No pude procesar tu mensaje. Inténtalo de nuevo.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error de conexión. Inténtalo de nuevo." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <>
      <style>{`
        @keyframes chat-dot-pulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes chat-slide-up {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Floating button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Cerrar chat" : "Abrir chat con Flow"}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl shadow-violet-900/40 transition-transform hover:scale-105 active:scale-95"
        style={{ background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)" }}
      >
        {isOpen ? (
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 flex w-80 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d1a] shadow-2xl shadow-violet-900/30"
          style={{ maxHeight: "500px", animation: "chat-slide-up 0.22s ease-out" }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3"
            style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(6,182,212,0.15) 100%)" }}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
              style={{ background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)" }}
            >
              F
            </div>
            <div>
              <p className="text-sm font-black text-white">Flow</p>
              <p className="text-[10px] text-white/40">Asistente de SocialFlow</p>
            </div>
            <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              En línea
            </span>
          </div>

          {/* Messages */}
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4" style={{ maxHeight: "340px" }}>
            {messages.map((msg, i) => {
              const cta = msg.role === "assistant" ? detectCta(msg.content) : null;
              return (
                <div key={i} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                  <div
                    className={[
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "rounded-br-sm bg-violet-600/80 text-white"
                        : "rounded-bl-sm bg-white/8 text-white/85",
                    ].join(" ")}
                  >
                    {msg.content}
                  </div>
                  {cta && (
                    <Link
                      href={`/socialflow/auth?type=${cta}`}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-3.5 py-2 text-xs font-black text-white shadow-lg shadow-violet-500/25 transition hover:brightness-110"
                    >
                      {cta === "influencer" ? "Crear cuenta como Influencer" : "Crear cuenta como Empresa"}
                      <span>→</span>
                    </Link>
                  )}
                </div>
              );
            })}
            {isLoading && (
              <div className="flex items-start">
                <div className="rounded-2xl rounded-bl-sm bg-white/8 px-3.5 py-2.5">
                  <LoadingDots />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 border-t border-white/8 bg-[#0a0a15] px-3 py-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              placeholder="Escribe tu pregunta..."
              className="flex-1 rounded-xl bg-white/8 px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:bg-white/12 disabled:opacity-50"
            />
            <button
              onClick={() => void sendMessage()}
              disabled={!input.trim() || isLoading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white transition hover:bg-violet-500 disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
