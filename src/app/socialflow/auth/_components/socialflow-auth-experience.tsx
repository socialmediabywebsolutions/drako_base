"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { listSocialFlowPaidPlans, type SocialFlowAccountType } from "@/lib/socialflow/billing/plans";

type SocialFlowAuthMode = "login" | "register";

type AuthResponseBody = {
  message?: string;
  error?: string;
  code?: string;
};

// ─── Design tokens — mismos que landing-client.tsx / planes-client.tsx ──────────
const BG = "#F7F6FA";
const INK = "#1a1a2e";
const MUTED = "#64748b";

const IG_PINK = "#DD2A7B";
const LI_BLUE = "#0A66C2";
const BRAND_ACCENT = "#4338CA";
const IG_GRADIENT = "linear-gradient(90deg, #F58529, #DD2A7B, #8134AF)";
const LI_GRADIENT = "linear-gradient(90deg, #0A66C2, #0077B5)";
const BRAND_GRADIENT = "linear-gradient(90deg, #6D5DFB, #4338CA)";

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
        badge: "✓ Plan Influencer · 15 días gratis",
        registerTitle: "Crea tu cuenta de Influencer",
        registerSubtitle: "Empieza gratis 15 días en Socialcors para Influencers",
        loginTitle: "Bienvenido de vuelta, Influencer",
        loginSubtitle: "Accede a tu panel de marketing para creadores",
        registerButtonLabel: "Crear cuenta de Influencer →",
        loginButtonLabel: "Entrar a Socialcors →",
        gradient: IG_GRADIENT,
        accentColor: IG_PINK,
      }
    : accountType === "empresa"
    ? {
        badge: "✓ Plan Empresa · 15 días gratis",
        registerTitle: "Crea tu cuenta de Empresa",
        registerSubtitle: "Empieza gratis 15 días en Socialcors para Empresas",
        loginTitle: "Bienvenido de vuelta",
        loginSubtitle: "Accede a tu panel de marketing empresarial",
        registerButtonLabel: "Crear cuenta de Empresa →",
        loginButtonLabel: "Entrar a Socialcors →",
        gradient: LI_GRADIENT,
        accentColor: LI_BLUE,
      }
    : null;

  // Acento activo del panel (tabs, botón, badge) — colores de red cuando hay type,
  // morado de marca por defecto.
  const activeGradient = typeConfig?.gradient ?? BRAND_GRADIENT;
  const activeAccent = typeConfig?.accentColor ?? BRAND_ACCENT;

  // Toggle local del panel "sin type" — solo cambia qué se previsualiza a la izquierda,
  // nunca la URL ni el accountType real (eso solo lo fija ?type= al llegar desde la landing).
  const [previewType, setPreviewType] = useState<SocialFlowAccountType>("influencer");

  const [mode, setMode] = useState<SocialFlowAuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (mode === "register" && !name.trim()) {
      setError("Introduce tu nombre.");
      return;
    }
    if (!email.trim()) {
      setError("Introduce tu correo electrónico.");
      return;
    }
    if (!password) {
      setError("Introduce tu contraseña.");
      return;
    }

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
      <div className="rounded-2xl border border-black/[0.06] bg-white p-7 shadow-[0_8px_30px_rgba(15,15,35,0.08)] sm:p-9">

        {/* Mode tabs */}
        <div className="mb-7 grid grid-cols-2 overflow-hidden rounded-xl border border-black/[0.06] bg-black/[0.02] p-1">
          {(["login", "register"] as SocialFlowAuthMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(null); }}
              className="rounded-lg px-4 py-2.5 text-sm font-bold transition"
              style={
                mode === m
                  ? { background: activeGradient, color: "#fff", boxShadow: `0 4px 14px ${activeAccent}40` }
                  : { color: MUTED }
              }
            >
              {m === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          ))}
        </div>

        {typeConfig && mode === "register" && (
          <div
            className="mb-4 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold"
            style={{ borderColor: `${activeAccent}40`, backgroundColor: `${activeAccent}14`, color: activeAccent }}
          >
            {typeConfig.badge}
          </div>
        )}

        <h2 className="mb-1 text-2xl font-black tracking-tight" style={{ color: INK }}>
          {mode === "login"
            ? (typeConfig?.loginTitle ?? "Bienvenido de vuelta")
            : (typeConfig?.registerTitle ?? "Crea tu cuenta")}
        </h2>
        <p className="mb-7 text-sm" style={{ color: MUTED }}>
          {mode === "login"
            ? (typeConfig?.loginSubtitle ?? "Accede a tu panel de marketing")
            : (typeConfig?.registerSubtitle ?? "Empieza gratis 15 días — sin tarjeta de crédito")}
        </p>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
                  className="text-xs font-semibold transition-colors hover:opacity-75"
                  style={{ color: activeAccent }}
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
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              placeholder="Tu contraseña segura"
              className="auth-input"
            />
          </FieldLabel>

          {mode === "register" && (passwordFocused || password.length > 0) && (
            <PasswordRequirements password={password} />
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 w-full rounded-xl px-5 py-3.5 text-sm font-black tracking-wide text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: activeGradient, boxShadow: `0 8px 20px ${activeAccent}40` }}
          >
            {isSubmitting
              ? "Un momento…"
              : mode === "login"
                ? (typeConfig?.loginButtonLabel ?? "Entrar a Socialcors →")
                : (typeConfig?.registerButtonLabel ?? "Entrar a Socialcors →")}
          </button>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: `${MUTED}99` }}>
          Al continuar aceptas los{" "}
          <span style={{ color: MUTED }}>Términos de servicio</span> y la{" "}
          <span style={{ color: MUTED }}>Política de privacidad</span>.
        </p>
      </div>
    </aside>
  );

  return (
    <main className="relative min-h-screen overflow-hidden" style={{ backgroundColor: BG, color: INK }}>

      {/* Gradient orbs — tonos suaves para fondo claro */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="sf-orb-1 absolute left-[-15%] top-[-10%] h-[500px] w-[500px] rounded-full bg-violet-200/30 blur-[120px]" />
        <div className="sf-orb-2 absolute right-[-10%] bottom-[-10%] h-[400px] w-[400px] rounded-full bg-fuchsia-200/25 blur-[100px]" />
        <div className="sf-orb-3 absolute left-[40%] top-[50%] h-[300px] w-[300px] rounded-full bg-cyan-100/20 blur-[90px]" />
      </div>

      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{ backgroundImage: "radial-gradient(rgba(26,26,46,0.08) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-5 py-16 sm:px-8 lg:flex-row lg:items-center lg:gap-16 lg:py-10">

        {typeConfig ? (
          <>
            {/* Left — sales content */}
            <div className="mb-10 w-full max-w-xl lg:mb-0 lg:flex-1">
              <Link href="/" className="mb-8 flex items-center gap-3">
                <img src="https://pub-3e782268d66e465bbe7c7fa767074ee2.r2.dev/assets/logo-cabecera.png" alt="Socialcors" className="h-10 w-auto" />
                <span className="text-xl font-black tracking-tight" style={{ color: INK }}>
                  Socialcors
                </span>
              </Link>

              {accountType === "influencer" ? (
                <>
                  <h1
                    className="text-4xl font-black leading-tight tracking-tight sm:text-5xl"
                    style={{ background: IG_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
                  >
                    Para Influencers y Creadores
                  </h1>

                  <p className="mt-5 text-lg leading-relaxed" style={{ color: MUTED }}>
                    ¿Pasas horas pensando qué publicar, cuándo publicar y cómo escribir captions que conecten? Eso se acabó.
                  </p>

                  <p className="mt-6 text-2xl font-bold" style={{ color: INK }}>
                    La IA publica por ti mientras tú creces
                  </p>

                  <ul className="mt-6 space-y-3">
                    {[
                      "Sube una foto — caption, hashtags y hora óptima en 10 segundos",
                      "Publicación automática en Instagram sin tocar el móvil",
                      "Detecta sponsors y colaboraciones en tus DMs automáticamente",
                    ].map((b) => (
                      <li key={b} className="flex items-start gap-3 text-sm" style={{ color: `${INK}b3` }}>
                        <span className="mt-0.5 shrink-0 font-black" style={{ color: IG_PINK }}>✓</span>
                        {b}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/socialflow/planes?type=influencer"
                    className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-black text-white shadow-lg transition-all hover:brightness-110 hover:-translate-y-0.5"
                    style={{ background: IG_GRADIENT, boxShadow: `0 10px 24px ${IG_PINK}33` }}
                  >
                    Ver los 3 planes en detalle →
                  </Link>

                  <p className="mt-7 text-center text-lg font-black" style={{ color: INK }}>Empieza hoy. Publica mañana.</p>
                  <p className="mt-2 text-center text-xs" style={{ color: MUTED }}>✓ 15 días gratis · ✓ Sin tarjeta · ✓ Cancela cuando quieras</p>
                </>
              ) : (
                <>
                  <h1
                    className="text-4xl font-black leading-tight tracking-tight sm:text-5xl"
                    style={{ background: LI_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}
                  >
                    Para Empresas y PYMEs
                  </h1>

                  <p className="mt-5 text-lg leading-relaxed" style={{ color: MUTED }}>
                    ¿Tu community manager cuesta más de 1.500€/mes y aún así no consigues constancia, leads ni resultados medibles?
                  </p>

                  <p className="mt-6 text-2xl font-bold" style={{ color: INK }}>
                    Tu equipo de marketing con IA, por menos que un community manager
                  </p>

                  <ul className="mt-6 space-y-3">
                    {[
                      "Contenido auténtico generado desde tu web, PDFs y catálogo de productos",
                      "Responde comentarios y DMs con el conocimiento real de tu negocio 24/7",
                      "Detecta leads y genera presupuestos automáticamente desde conversaciones",
                    ].map((b) => (
                      <li key={b} className="flex items-start gap-3 text-sm" style={{ color: `${INK}b3` }}>
                        <span className="mt-0.5 shrink-0 font-black" style={{ color: LI_BLUE }}>✓</span>
                        {b}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/socialflow/planes?type=empresa"
                    className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-black text-white shadow-lg transition-all hover:brightness-110 hover:-translate-y-0.5"
                    style={{ background: LI_GRADIENT, boxShadow: `0 10px 24px ${LI_BLUE}33` }}
                  >
                    Ver los 3 planes en detalle →
                  </Link>

                  <p className="mt-7 text-center text-lg font-black" style={{ color: INK }}>Configura hoy. Tu IA trabaja mañana.</p>
                  <p className="mt-2 text-center text-xs" style={{ color: MUTED }}>✓ 15 días gratis · ✓ Sin tarjeta · ✓ Cancela cuando quieras</p>
                </>
              )}
            </div>

            {authForm}
          </>
        ) : (
          <>
            {/* Left — brand + plan preview (sin type: el visitante elige aquí, en local
                state, qué previsualizar — no cambia la URL) */}
            <div className="mb-10 w-full max-w-xl lg:mb-0 lg:flex-1">
              <Link href="/" className="mb-8 flex items-center gap-3">
                <img src="https://pub-3e782268d66e465bbe7c7fa767074ee2.r2.dev/assets/logo-cabecera.png" alt="Socialcors" className="h-10 w-auto" />
                <span className="text-xl font-black tracking-tight" style={{ color: INK }}>
                  Socialcors
                </span>
              </Link>

              <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl" style={{ color: INK }}>
                Tu Community Manager con Inteligencia Artificial
              </h1>
              <p className="mt-4 text-base leading-relaxed" style={{ color: MUTED }}>
                Elige tu plan y empieza gratis hoy — sin tarjeta de crédito
              </p>

              {/* Toggle Influencer / Empresa — mismo patrón visual que los tabs de modo del
                  formulario, de arriba (líneas 130-147) */}
              <div className="mt-8 grid grid-cols-2 overflow-hidden rounded-xl border border-black/[0.06] bg-black/[0.02] p-1">
                {(["influencer", "empresa"] as SocialFlowAccountType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setPreviewType(t)}
                    className="rounded-lg px-4 py-2.5 text-sm font-bold transition"
                    style={
                      previewType === t
                        ? {
                            background: t === "influencer" ? IG_GRADIENT : LI_GRADIENT,
                            color: "#fff",
                            boxShadow: `0 4px 14px ${(t === "influencer" ? IG_PINK : LI_BLUE)}40`,
                          }
                        : { color: MUTED }
                    }
                  >
                    {t === "influencer" ? "Influencer" : "Empresa"}
                  </button>
                ))}
              </div>

              {/* 3 tarjetas de plan — datos reales de plans.ts, nunca hardcodeados */}
              <div className="mt-5 grid gap-3">
                {listSocialFlowPaidPlans(previewType).map((plan) => {
                  const isPopular = plan.code.endsWith("_basico");
                  const shortName = plan.label.replace(/^(Influencer|Empresa)\s+/, "");
                  const previewAccent = previewType === "influencer" ? IG_PINK : LI_BLUE;
                  const previewGradient = previewType === "influencer" ? IG_GRADIENT : LI_GRADIENT;
                  return (
                    <Link
                      key={plan.code}
                      href={`/socialflow/planes?type=${previewType}`}
                      className="relative block rounded-xl bg-white p-4 transition-all duration-300 hover:-translate-y-0.5"
                      style={{
                        border: `1.5px solid ${previewAccent}`,
                        boxShadow: isPopular ? `0 6px 20px ${previewAccent}26` : "0 1px 3px rgba(15,15,35,0.05)",
                      }}
                    >
                      {isPopular && (
                        <span
                          className="absolute -top-2.5 left-4 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow"
                          style={{ background: previewGradient }}
                        >
                          Más popular
                        </span>
                      )}
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className="text-sm font-black" style={{ color: INK }}>{shortName}</h4>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-black" style={{ color: previewAccent }}>{plan.priceEur}€</span>
                          <span className="text-[11px]" style={{ color: MUTED }}>/mes</span>
                        </div>
                      </div>
                      <p className="mt-1 text-xs" style={{ color: MUTED }}>{plan.description}</p>
                      <ul className="mt-2.5 space-y-1">
                        {plan.features.slice(0, 4).map((feature) => (
                          <li key={feature} className="flex items-start gap-1.5 text-[11px]" style={{ color: `${INK}b3` }}>
                            <span className="mt-px shrink-0 font-black" style={{ color: previewAccent }}>✓</span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </Link>
                  );
                })}
              </div>

              <p className="mt-6 text-sm leading-relaxed" style={{ color: MUTED }}>
                ¿Por qué Socialcors? Analizamos, creamos, publicamos y aprendemos por ti — en Instagram y LinkedIn — mientras tú te dedicas a tu negocio.
              </p>
              <Link
                href={`/socialflow/planes?type=${previewType}`}
                className="mt-3 inline-flex items-center gap-1 text-sm font-bold transition-colors hover:opacity-75"
                style={{ color: previewType === "influencer" ? IG_PINK : LI_BLUE }}
              >
                Ver todos los detalles de cada plan →
              </Link>
            </div>

            {authForm}
          </>
        )}

      </div>
    </main>
  );
}

function PasswordRequirements({ password }: { password: string }) {
  const requirements = [
    { label: "Mínimo 8 caracteres", met: password.length >= 8 },
    { label: "Al menos una mayúscula", met: /[A-Z]/.test(password) },
    { label: "Al menos un número", met: /\d/.test(password) },
  ];
  return (
    <ul className="-mt-2 space-y-1 pl-1">
      {requirements.map((req) => (
        <li
          key={req.label}
          className="flex items-center gap-1.5 text-xs font-medium transition-colors"
          style={{ color: req.met ? "#16a34a" : `${MUTED}99` }}
        >
          <span aria-hidden="true">{req.met ? "✓" : "○"}</span>
          {req.label}
        </li>
      ))}
    </ul>
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
        <span className="text-sm font-semibold" style={{ color: `${INK}b3` }}>{label}</span>
        {right}
      </div>
      {children}
    </label>
  );
}
