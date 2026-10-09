"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "./auth-shell";
import { AuthField, PasswordInput } from "./auth-fields";

type SocialFlowAuthMode = "login" | "register";

type AuthResponseBody = {
  message?: string;
  error?: string;
  code?: string;
};

// Punto de color del distintivo de tipo de cuenta (identidad de red del tipo elegido en la landing).
const IG_PINK = "#DD2A7B";
const LI_BLUE = "#0A66C2";

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

  // ?type=influencer|empresa (lo fija la landing / la página de planes): condiciona el distintivo, los
  // textos de apoyo, la etiqueta del botón de registro y el destino tras registrarse.
  const rawType = searchParams.get("type");
  const accountType = rawType === "influencer" || rawType === "empresa" ? rawType : null;
  const typeConfig = accountType === "influencer"
    ? {
        badge: "✓ Plan Influencer · 15 días gratis",
        registerSubtitle: "Empieza gratis 15 días en Socialcors para Influencers",
        loginSubtitle: "Accede a tu panel de marketing para creadores",
        registerButtonLabel: "Crear cuenta de Influencer →",
        dot: IG_PINK,
      }
    : accountType === "empresa"
    ? {
        badge: "✓ Plan Empresa · 15 días gratis",
        registerSubtitle: "Empieza gratis 15 días en Socialcors para Empresas",
        loginSubtitle: "Accede a tu panel de marketing empresarial",
        registerButtonLabel: "Crear cuenta de Empresa →",
        dot: LI_BLUE,
      }
    : null;

  const [mode, setMode] = useState<SocialFlowAuthMode>(searchParams.get("mode") === "register" ? "register" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Aceptación de Términos y Política de privacidad (solo se exige en el registro).
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (mode === "register" && !name.trim()) {
      setError("Introduce tu nombre.");
      return;
    }
    if (mode === "register" && !acceptedTerms) {
      setError("Debes aceptar los Términos de servicio y la Política de privacidad para crear tu cuenta.");
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
          mode === "login"
            ? { email, password }
            : { email, name, password, acceptedTerms: true, accountType: accountType ?? undefined },
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

  const submitLabel = isSubmitting
    ? "Un momento…"
    : mode === "login"
      ? "Entrar en SocialCors →"
      : (typeConfig?.registerButtonLabel ?? "Crear cuenta →");

  return (
    <AuthShell>
      <div className="sa-card sa-rise">
        <h1 className="sa-title">Bienvenido a SocialCors</h1>
        <p className="sa-sub">Tu Community Manager con Inteligencia Artificial</p>

        {/* Selector de vista: cambia entre login y registro sin salir de la página */}
        <div className="sa-tabs" role="tablist" aria-label="Acceso a SocialCors">
          <span className="sa-pill" data-mode={mode} aria-hidden="true" />
          {(["login", "register"] as SocialFlowAuthMode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              id={`sa-tab-${m}`}
              aria-selected={mode === m}
              aria-controls="sa-panel"
              className="sa-tab"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
            >
              {m === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          ))}
        </div>

        <div key={mode} id="sa-panel" role="tabpanel" aria-labelledby={`sa-tab-${mode}`} className="sa-panel sa-swap">
          {typeConfig && mode === "register" && (
            <span className="sa-badge" style={{ "--dot": typeConfig.dot } as React.CSSProperties}>
              <i aria-hidden="true" />
              {typeConfig.badge}
            </span>
          )}
          <p className="sa-context">
            {mode === "login"
              ? (typeConfig?.loginSubtitle ?? "Accede a tu panel de marketing")
              : (typeConfig?.registerSubtitle ?? "Empieza gratis 15 días — sin tarjeta de crédito")}
          </p>

          <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={isSubmitting}>
            {mode === "register" && (
              <AuthField id="sa-name" label="Tu nombre">
                <input
                  id="sa-name"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="sa-input"
                />
              </AuthField>
            )}

            <AuthField id="sa-email" label="Correo electrónico">
              <input
                id="sa-email"
                required
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                className="sa-input"
              />
            </AuthField>

            <AuthField
              id="sa-password"
              label="Contraseña"
              right={
                mode === "login" ? (
                  <Link href="/socialflow/auth/reset-password" className="sa-link">
                    ¿Olvidaste tu contraseña?
                  </Link>
                ) : undefined
              }
            >
              <PasswordInput
                id="sa-password"
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                placeholder="Tu contraseña segura"
              />
            </AuthField>

            {mode === "register" && (passwordFocused || password.length > 0) && (
              <PasswordRequirements password={password} />
            )}

            {error && (
              <div role="alert" className="sa-error">
                {error}
              </div>
            )}

            {mode === "register" && (
              <label className="sa-check">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(event) => setAcceptedTerms(event.target.checked)}
                  required
                />
                <span>
                  He leído y acepto los{" "}
                  <Link href="/terminos" target="_blank" rel="noopener noreferrer">
                    Términos de servicio
                  </Link>{" "}
                  y la{" "}
                  <Link href="/privacidad" target="_blank" rel="noopener noreferrer">
                    Política de privacidad
                  </Link>
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={isSubmitting || (mode === "register" && !acceptedTerms)}
              className="sa-btn"
            >
              {isSubmitting && <span className="sa-spin" aria-hidden="true" />}
              {submitLabel}
            </button>
          </form>

          {mode === "login" && (
            <p className="sa-legal">
              Al continuar aceptas los{" "}
              <Link href="/terminos" target="_blank" rel="noopener noreferrer">
                Términos de servicio
              </Link>{" "}
              y la{" "}
              <Link href="/privacidad" target="_blank" rel="noopener noreferrer">
                Política de privacidad
              </Link>
              .
            </p>
          )}
        </div>
      </div>

      {/* Los planes viven en su propia página: aquí solo un enlace discreto. /socialflow/planes exige
          ?type=; sin él redirige al Home, así que se ofrecen los dos tipos cuando no se conoce. */}
      <p className="sa-plans">
        {accountType ? (
          <Link href={`/socialflow/planes?type=${accountType}`}>Ver planes →</Link>
        ) : (
          <>
            Ver planes:{" "}
            <Link href="/socialflow/planes?type=influencer">Influencer</Link>
            {" · "}
            <Link href="/socialflow/planes?type=empresa">Empresa</Link>
          </>
        )}
      </p>
    </AuthShell>
  );
}

function PasswordRequirements({ password }: { password: string }) {
  const requirements = [
    { label: "Mínimo 8 caracteres", met: password.length >= 8 },
    { label: "Al menos una mayúscula", met: /[A-Z]/.test(password) },
    { label: "Al menos un número", met: /\d/.test(password) },
  ];
  return (
    <ul className="sa-reqs" aria-label="Requisitos de la contraseña">
      {requirements.map((req) => (
        <li key={req.label} className="sa-req" data-met={req.met}>
          <span aria-hidden="true">{req.met ? "✓" : "○"}</span>
          {req.label}
        </li>
      ))}
    </ul>
  );
}
