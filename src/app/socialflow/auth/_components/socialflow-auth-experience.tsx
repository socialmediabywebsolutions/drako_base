"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type SocialFlowAuthMode = "login" | "register";

type AuthResponseBody = {
  message?: string;
  error?: string;
  code?: string;
};

function resolveSafeRedirectTarget(rawTarget: string | null, fallback = "/socialflow") {
  if (!rawTarget) return fallback;
  try {
    const target = new URL(rawTarget, window.location.origin);
    if (target.origin !== window.location.origin) return fallback;
    return `${target.pathname}${target.search}${target.hash}` || fallback;
  } catch {
    return fallback;
  }
}

export default function SocialFlowAuthExperience() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<SocialFlowAuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const endpoint =
      mode === "login"
        ? "/api/socialflow/auths/logins"
        : "/api/socialflow/auths/registrations";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "login" ? { email, password } : { email, name, password },
        ),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as AuthResponseBody;
        throw new Error(payload.message || payload.error || payload.code || "Error de autenticación.");
      }

      const redirectTarget = resolveSafeRedirectTarget(
        searchParams.get("callbackUrl") || searchParams.get("next"),
      );
      window.location.assign(redirectTarget);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Error de autenticación.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030312] text-white">

      {/* Gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="sf-orb-1 absolute left-[-15%] top-[-10%] h-[500px] w-[500px] rounded-full bg-violet-600/25 blur-[120px]" />
        <div className="sf-orb-2 absolute right-[-10%] bottom-[-10%] h-[400px] w-[400px] rounded-full bg-fuchsia-600/20 blur-[100px]" />
        <div className="sf-orb-3 absolute left-[40%] top-[50%] h-[300px] w-[300px] rounded-full bg-blue-600/15 blur-[90px]" />
      </div>

      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-5 py-16 sm:px-8 lg:flex-row lg:items-center lg:gap-16 lg:py-10">

        {/* Left — brand + preview */}
        <div className="mb-10 w-full max-w-xl lg:mb-0 lg:flex-1">
          {/* Logo */}
          <Link href="/" className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-black shadow-lg shadow-violet-500/30">
              SF
            </div>
            <span className="text-xl font-black tracking-tight">
              Social<span className="sf-shimmer-text">Flow</span>
            </span>
          </Link>

          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-violet-300">
              Sistema operativo de marketing con IA
            </span>
          </div>

          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl">
            La IA que gestiona tu marketing{" "}
            <span className="sf-shimmer-text">mientras tú te dedicas a tu negocio.</span>
          </h1>

          <p className="mt-5 text-base leading-relaxed text-white/55">
            Crea campañas completas, publica automáticamente, responde con tu voz y detecta leads — desde un único panel.
          </p>

          {/* Mini dashboard mockup */}
          <div className="sf-float mt-10 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d1a] shadow-2xl shadow-violet-900/20">
            <div className="flex items-center gap-2 border-b border-white/5 bg-white/5 px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-red-500/70" />
              <span className="h-2 w-2 rounded-full bg-yellow-500/70" />
              <span className="h-2 w-2 rounded-full bg-green-500/70" />
              <span className="ml-3 text-xs text-white/25">SocialFlow — Dashboard</span>
            </div>
            <div className="p-5">
              <div className="mb-4 grid grid-cols-3 gap-2">
                {[
                  { l: "Publicaciones hoy", v: "12", c: "text-violet-400" },
                  { l: "Leads detectados", v: "3", c: "text-fuchsia-400" },
                  { l: "Engagement", v: "↑ 4.2%", c: "text-blue-400" },
                ].map((stat) => (
                  <div key={stat.l} className="rounded-lg border border-white/5 bg-white/5 p-3">
                    <p className="text-[9px] text-white/35 mb-1">{stat.l}</p>
                    <p className={`text-base font-black ${stat.c}`}>{stat.v}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  { t: "10:00", net: "IG", msg: "Nuevo lanzamiento de producto", s: "✓ publicado", sc: "text-emerald-400" },
                  { t: "14:30", net: "LK", msg: "Artículo de tendencias IA", s: "⏱ programado", sc: "text-white/30" },
                  { t: "18:00", net: "TK", msg: "Behind the scenes del equipo", s: "⚡ generando…", sc: "text-fuchsia-400 animate-pulse" },
                ].map((item) => (
                  <div key={item.t} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/3 px-3 py-2">
                    <span className="w-9 shrink-0 text-[10px] text-white/25">{item.t}</span>
                    <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">{item.net}</span>
                    <span className="flex-1 truncate text-xs text-white/55">{item.msg}</span>
                    <span className={`text-[10px] ${item.sc}`}>{item.s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right — auth form */}
        <aside className="w-full max-w-md lg:flex-shrink-0">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-7 shadow-2xl shadow-violet-900/20 backdrop-blur-sm sm:p-9">

            {/* Mode tabs */}
            <div className="mb-7 grid grid-cols-2 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-1">
              {(["login", "register"] as SocialFlowAuthMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError(null); }}
                  className={`rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                    mode === m
                      ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md shadow-violet-500/20"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {m === "login" ? "Iniciar sesión" : "Crear cuenta"}
                </button>
              ))}
            </div>

            <h2 className="mb-1 text-2xl font-black tracking-tight text-white">
              {mode === "login" ? "Bienvenido de vuelta" : "Empieza hoy"}
            </h2>
            <p className="mb-7 text-sm text-white/45">
              {mode === "login"
                ? "Accede a tu panel de marketing."
                : "14 días gratis. Sin tarjeta de crédito."}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <FieldLabel label="Tu nombre">
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="auth-input"
                  />
                </FieldLabel>
              )}

              <FieldLabel label="Correo electrónico">
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@empresa.com"
                  className="auth-input"
                />
              </FieldLabel>

              <FieldLabel
                label="Contraseña"
                right={
                  mode === "login" ? (
                    <Link
                      href="/socialflow/auth/reset-password"
                      className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </Link>
                  ) : undefined
                }
              >
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña segura"
                  className="auth-input"
                />
              </FieldLabel>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3.5 text-sm font-black tracking-wide text-white shadow-lg shadow-violet-500/25 transition hover:brightness-110 hover:shadow-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting
                  ? "Un momento…"
                  : mode === "login"
                    ? "Entrar a SocialFlow"
                    : "Crear mi cuenta"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-white/25">
              Al continuar aceptas los{" "}
              <span className="text-white/40">Términos de servicio</span> y la{" "}
              <span className="text-white/40">Política de privacidad</span>.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function FieldLabel({
  label,
  right,
  children,
}: {
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-white/70">{label}</span>
        {right}
      </div>
      {children}
    </label>
  );
}
