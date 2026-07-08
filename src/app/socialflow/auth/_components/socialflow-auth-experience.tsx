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

  const rawType = searchParams.get("type");
  const accountType = rawType === "influencer" || rawType === "empresa" ? rawType : null;
  const typeConfig = accountType === "influencer"
    ? {
        badge: "✓ Plan Influencer · 7 días gratis",
        badgeCls: "border-violet-500/25 bg-violet-500/10 text-violet-300",
        registerTitle: "Crea tu cuenta como Influencer",
        registerSubtitle: "Conecta Instagram y TikTok. La IA publica por ti.",
        gradient: "from-violet-600 to-pink-500",
        btnShadow: "shadow-violet-500/25 hover:shadow-violet-500/40",
        tabShadow: "shadow-violet-500/20",
      }
    : accountType === "empresa"
    ? {
        badge: "✓ Plan Empresa · 7 días gratis",
        badgeCls: "border-blue-500/25 bg-blue-500/10 text-blue-300",
        registerTitle: "Crea tu cuenta como Empresa",
        registerSubtitle: "Conecta Instagram, Facebook y LinkedIn. La IA gestiona tu marca.",
        gradient: "from-blue-600 to-cyan-500",
        btnShadow: "shadow-blue-500/25 hover:shadow-blue-500/40",
        tabShadow: "shadow-blue-500/20",
      }
    : null;

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

      if (mode === "register") {
        const accountType = searchParams.get("type");
        if (accountType === "influencer" || accountType === "empresa") {
          await fetch("/api/socialflow/onboarding/account-type", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ accountType }),
          }).catch((err) => console.error("ACCOUNT_TYPE_SAVE_ERROR", err));
          window.location.assign(
            accountType === "influencer"
              ? "/socialflow/onboarding/plans"
              : "/socialflow/onboarding/plans-empresa",
          );
        } else {
          window.location.assign("/socialflow/onboarding/type");
        }
        return;
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

  const authForm = (
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
                  ? `bg-gradient-to-r ${typeConfig?.gradient ?? "from-violet-500 to-fuchsia-500"} text-white shadow-md ${typeConfig?.tabShadow ?? "shadow-violet-500/20"}`
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              {m === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          ))}
        </div>

        {typeConfig && mode === "register" && (
          <div className={`mb-4 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${typeConfig.badgeCls}`}>
            {typeConfig.badge}
          </div>
        )}

        <h2 className="mb-1 text-2xl font-black tracking-tight text-white">
          {mode === "login" ? "Bienvenido de vuelta" : (typeConfig?.registerTitle ?? "Empieza hoy")}
        </h2>
        <p className="mb-7 text-sm text-white/45">
          {mode === "login"
            ? "Accede a tu panel de marketing."
            : (typeConfig?.registerSubtitle ?? "7 días gratis. Sin tarjeta de crédito.")}
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
            className={`mt-2 w-full rounded-xl bg-gradient-to-r ${typeConfig?.gradient ?? "from-violet-500 to-fuchsia-500"} px-5 py-3.5 text-sm font-black tracking-wide text-white shadow-lg ${typeConfig?.btnShadow ?? "shadow-violet-500/25 hover:shadow-violet-500/40"} transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isSubmitting
              ? "Un momento…"
              : mode === "login"
                ? "Entrar a Socialcors"
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
  );

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

        {typeConfig ? (
          <>
            {/* Left — sales content */}
            <div className="mb-10 w-full max-w-xl lg:mb-0 lg:flex-1">
              <Link href="/" className="mb-8 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${typeConfig.gradient} text-sm font-black shadow-lg shadow-violet-500/30`}>
                  SC
                </div>
                <span className="text-xl font-black tracking-tight">
                  Social<span className="sf-shimmer-text">cors</span>
                </span>
              </Link>

              {accountType === "influencer" ? (
                <>
                  {/* 1. Identificación — lo primero y más prominente */}
                  <h1 className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-4xl font-black leading-tight tracking-tight text-transparent sm:text-5xl">
                    Para Influencers y Creadores
                  </h1>

                  {/* 2. Problema */}
                  <p className="mt-5 text-lg leading-relaxed text-white/70">
                    ¿Pasas horas pensando qué publicar, cuándo publicar y cómo escribir captions que conecten? Eso se acabó.
                  </p>

                  {/* 3. Solución */}
                  <p className="mt-6 text-2xl font-bold text-white">
                    La IA publica por ti mientras tú creces
                  </p>

                  {/* 4. Beneficios concretos */}
                  <ul className="mt-6 space-y-3">
                    {[
                      "Sube una foto — caption, hashtags y hora óptima en 10 segundos",
                      "Publicación automática en Instagram y TikTok sin tocar el móvil",
                      "Detecta sponsors y colaboraciones en tus DMs automáticamente",
                    ].map((b) => (
                      <li key={b} className="flex items-start gap-3 text-sm text-white/75">
                        <span className="mt-0.5 shrink-0 font-black text-violet-400">✓</span>
                        {b}
                      </li>
                    ))}
                  </ul>

                  {/* 5. Planes */}
                  <div className="mt-8 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-white/40">Influencer Básico</p>
                      <p className="mt-2 text-2xl font-black text-white">49€<span className="text-sm font-normal text-white/40">/mes</span></p>
                      <p className="mt-1 text-[11px] text-white/40">Instagram + TikTok · 30 posts/mes</p>
                      <ul className="mt-3 space-y-1.5">
                        {["Captions con tu voz", "Hashtags por tendencias", "Publicación automática", "Comunidad básica"].map((f) => (
                          <li key={f} className="flex items-center gap-2 text-[11px] text-white/60">
                            <span className="text-violet-400">·</span>{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-violet-500/50 bg-violet-500/10 p-4">
                      <div className="mb-2 inline-block rounded-full bg-violet-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-violet-300">MÁS POPULAR</div>
                      <p className="text-xs font-bold uppercase tracking-widest text-violet-300">Influencer Pro</p>
                      <p className="mt-2 text-2xl font-black text-white">99€<span className="text-sm font-normal text-white/40">/mes</span></p>
                      <p className="mt-1 text-[11px] text-white/40">+Facebook +YouTube · 60 posts/mes</p>
                      <ul className="mt-3 space-y-1.5">
                        {["Todo lo básico", "IA genera imágenes", "Detecta sponsors", "WhatsApp orquestador"].map((f) => (
                          <li key={f} className="flex items-center gap-2 text-[11px] text-violet-200/80">
                            <span className="text-violet-400">·</span>{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 6. Cierre con urgencia */}
                  <p className="mt-7 text-center text-lg font-black text-white">Empieza hoy. Publica mañana.</p>
                  <p className="mt-2 text-center text-xs text-white/35">✓ 7 días gratis · ✓ Sin tarjeta · ✓ Cancela cuando quieras</p>
                </>
              ) : (
                <>
                  {/* 1. Identificación — lo primero y más prominente */}
                  <h1 className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-4xl font-black leading-tight tracking-tight text-transparent sm:text-5xl">
                    Para Empresas y PYMEs
                  </h1>

                  {/* 2. Problema */}
                  <p className="mt-5 text-lg leading-relaxed text-white/70">
                    ¿Tu community manager cuesta más de 1.500€/mes y aún así no consigues constancia, leads ni resultados medibles?
                  </p>

                  {/* 3. Solución */}
                  <p className="mt-6 text-2xl font-bold text-white">
                    Tu equipo de marketing con IA, por menos que un community manager
                  </p>

                  {/* 4. Beneficios concretos */}
                  <ul className="mt-6 space-y-3">
                    {[
                      "Contenido auténtico generado desde tu web, PDFs y catálogo de productos",
                      "Responde comentarios y DMs con el conocimiento real de tu negocio 24/7",
                      "Detecta leads y genera presupuestos automáticamente desde conversaciones",
                    ].map((b) => (
                      <li key={b} className="flex items-start gap-3 text-sm text-white/75">
                        <span className="mt-0.5 shrink-0 font-black text-blue-400">✓</span>
                        {b}
                      </li>
                    ))}
                  </ul>

                  {/* 5. Planes */}
                  <div className="mt-8 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-white/40">Empresa Básica</p>
                      <p className="mt-2 text-2xl font-black text-white">79€<span className="text-sm font-normal text-white/40">/mes</span></p>
                      <p className="mt-1 text-[11px] text-white/40">Instagram + Facebook + LinkedIn · 30 posts/mes</p>
                      <ul className="mt-3 space-y-1.5">
                        {["Base de Conocimiento", "Voz de marca", "CRM Social básico", "Respuesta automática"].map((f) => (
                          <li key={f} className="flex items-center gap-2 text-[11px] text-white/60">
                            <span className="text-blue-400">·</span>{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-2xl border border-blue-500/50 bg-blue-500/10 p-4">
                      <div className="mb-2 inline-block rounded-full bg-blue-500/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-blue-300">MÁS COMPLETO</div>
                      <p className="text-xs font-bold uppercase tracking-widest text-blue-300">Empresa Pro</p>
                      <p className="mt-2 text-2xl font-black text-white">149€<span className="text-sm font-normal text-white/40">/mes</span></p>
                      <p className="mt-1 text-[11px] text-white/40">+TikTok +Pinterest · 60 posts/mes</p>
                      <ul className="mt-3 space-y-1.5">
                        {["Todo lo básico", "Gestión de reputación", "Leads desde DMs", "WhatsApp orquestador"].map((f) => (
                          <li key={f} className="flex items-center gap-2 text-[11px] text-blue-200/80">
                            <span className="text-blue-400">·</span>{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* 6. Cierre con urgencia */}
                  <p className="mt-7 text-center text-lg font-black text-white">Configura hoy. Tu IA trabaja mañana.</p>
                  <p className="mt-2 text-center text-xs text-white/35">✓ 7 días gratis · ✓ Sin tarjeta · ✓ Cancela cuando quieras</p>
                </>
              )}
            </div>

            {authForm}
          </>
        ) : (
          <>
            {/* Left — brand + preview (original) */}
            <div className="mb-10 w-full max-w-xl lg:mb-0 lg:flex-1">
              <Link href="/" className="mb-8 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-black shadow-lg shadow-violet-500/30">
                  SC
                </div>
                <span className="text-xl font-black tracking-tight">
                  Social<span className="sf-shimmer-text">cors</span>
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
                  <span className="ml-3 text-xs text-white/25">Socialcors — Dashboard</span>
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

            {authForm}
          </>
        )}

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
