"use client";

/**
 * Sección de waitlist de socialcors.com
 *
 * Recoge email + producto de interés + perfil del visitante.
 * Guarda en D1 via /api/socialcors/waitlist y notifica por email a Cristóbal.
 * Diseño: fondo blanco · azul #3b82f6 · turquesa #06b6d4. NUNCA oscuro.
 */

import { useState } from "react";

const PRODUCTS = [
  { value: "mentoria", label: "Mentoría IA", desc: "Tutores IA para estudiantes", color: "#059669" },
  { value: "cazh",     label: "Cazh",        desc: "Finanzas inteligentes",       color: "#d97706" },
  { value: "rentia",   label: "Rentia",       desc: "Gestión de alquileres",       color: "#8b5cf6" },
  { value: "health",   label: "Health IA",    desc: "Salud accesible con IA",      color: "#10b981" },
  { value: "todo",     label: "Todo el ecosistema", desc: "Me interesa todo", color: "#3b82f6" },
];

const PROFILES = [
  { value: "familia",     label: "Familia / Estudiante" },
  { value: "propietario", label: "Propietario de vivienda" },
  { value: "inversor",    label: "Inversor / Fondo" },
  { value: "prensa",      label: "Prensa / Media" },
  { value: "otro",        label: "Otro" },
];

type Status = "idle" | "loading" | "success" | "error";

export default function WaitlistSection() {
  const [email,   setEmail]   = useState("");
  const [product, setProduct] = useState("");
  const [profile, setProfile] = useState("");
  const [status,  setStatus]  = useState<Status>("idle");
  const [error,   setError]   = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !product || !profile) return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/socialcors/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, product, profile }),
      });
      if (!res.ok) throw new Error("error");
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Algo ha ido mal. Prueba de nuevo o escríbenos directamente.");
    }
  }

  return (
    <section
      id="waitlist"
      className="py-24 px-6"
      style={{ backgroundColor: "#f8fafc" }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase mb-6"
            style={{ backgroundColor: "#eff6ff", color: "#3b82f6" }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
            Acceso anticipado
          </div>
          <h2
            className="text-4xl md:text-5xl font-black tracking-tight mb-5 leading-tight"
            style={{ color: "#0f172a" }}
          >
            Sé el primero<br />
            <span
              style={{
                backgroundImage: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              cuando lancemos.
            </span>
          </h2>
          <p className="text-lg leading-relaxed" style={{ color: "#64748b" }}>
            Apúntate a la lista de espera. Los primeros en entrar recibirán
            un <strong style={{ color: "#0f172a" }}>descuento exclusivo de lanzamiento</strong> y
            acceso antes que nadie.
          </p>
        </div>

        {/* Formulario o confirmación */}
        {status === "success" ? (
          <div
            className="rounded-3xl p-10 text-center border"
            style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: "linear-gradient(135deg, #3b82f6, #06b6d4)" }}
            >
              <svg className="w-8 h-8" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-2xl font-black mb-3" style={{ color: "#0f172a" }}>
              ¡Estás en la lista!
            </h3>
            <p className="text-base" style={{ color: "#64748b" }}>
              Te avisaremos antes del lanzamiento con tu descuento exclusivo.
              Mientras tanto, te mantendremos al día del progreso.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl p-8 md:p-10 border space-y-7"
            style={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0" }}
          >
            {/* Email */}
            <div>
              <label
                htmlFor="wl-email"
                className="block text-sm font-bold mb-2"
                style={{ color: "#0f172a" }}
              >
                Tu email
              </label>
              <input
                id="wl-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-4 py-3.5 rounded-xl border text-sm outline-none transition-all"
                style={{
                  borderColor: "#e2e8f0",
                  color: "#0f172a",
                  backgroundColor: "#f8fafc",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#3b82f6")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#e2e8f0")}
              />
            </div>

            {/* Producto */}
            <div>
              <p className="text-sm font-bold mb-3" style={{ color: "#0f172a" }}>
                ¿Qué producto te interesa más?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRODUCTS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setProduct(p.value)}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all"
                    style={{
                      borderColor: product === p.value ? p.color : "#e2e8f0",
                      backgroundColor: product === p.value ? "#f8fafc" : "#ffffff",
                      boxShadow: product === p.value ? `0 0 0 2px ${p.color}22` : "none",
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span>
                      <span className="block text-sm font-bold" style={{ color: "#0f172a" }}>{p.label}</span>
                      <span className="block text-xs" style={{ color: "#94a3b8" }}>{p.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Perfil */}
            <div>
              <p className="text-sm font-bold mb-3" style={{ color: "#0f172a" }}>
                ¿Quién eres?
              </p>
              <div className="flex flex-wrap gap-2">
                {PROFILES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setProfile(p.value)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
                    style={{
                      borderColor: profile === p.value ? "#3b82f6" : "#e2e8f0",
                      backgroundColor: profile === p.value ? "#eff6ff" : "#ffffff",
                      color: profile === p.value ? "#3b82f6" : "#64748b",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={status === "loading" || !email || !product || !profile}
              className="w-full py-4 text-base font-black rounded-2xl text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
                boxShadow: "0 8px 30px rgba(59,130,246,0.3)",
              }}
            >
              {status === "loading" ? "Enviando…" : "Apúntame a la lista →"}
            </button>

            <p className="text-xs text-center" style={{ color: "#94a3b8" }}>
              Sin spam. Solo te escribimos cuando algo importante ocurra.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
