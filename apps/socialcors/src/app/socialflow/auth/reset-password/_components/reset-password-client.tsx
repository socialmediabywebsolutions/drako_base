"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "../../_components/auth-shell";
import { AuthField, PasswordInput } from "../../_components/auth-fields";

type ApiError = { message?: string; error?: string };

function Card({ children }: { children: React.ReactNode }) {
  return (
    <AuthShell>
      <div className="sa-card sa-rise">{children}</div>
    </AuthShell>
  );
}

function BackToLogin({ button = false }: { button?: boolean }) {
  return button ? (
    <Link href="/socialflow/planes" className="sa-btn" style={{ textDecoration: "none" }}>
      Ir al inicio de sesión
    </Link>
  ) : (
    <Link href="/socialflow/planes" className="sa-link">
      ← Volver al inicio de sesión
    </Link>
  );
}

function RequestResetForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/socialflow/auths/password-resets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as ApiError;
        throw new Error(data.message ?? data.error ?? "Algo salió mal.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <>
        <p className="sy-eyebrow-lite">Email enviado</p>
        <h1 className="sa-title">Revisa tu bandeja</h1>
        <p className="sa-sub" style={{ marginBottom: "1.5rem" }}>
          Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña. Caduca en 1 hora.
        </p>
        <BackToLogin />
      </>
    );
  }

  return (
    <>
      <p className="sy-eyebrow-lite">Recuperar acceso</p>
      <h1 className="sa-title">Restablece tu contraseña</h1>
      <p className="sa-sub" style={{ marginBottom: "1.5rem" }}>
        Introduce tu email y te enviaremos un enlace para crear una nueva contraseña.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4" aria-busy={submitting}>
        <AuthField id="sa-reset-email" label="Email">
          <input
            id="sa-reset-email"
            required
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="sa-input"
            placeholder="tu@empresa.com"
          />
        </AuthField>
        {error && (
          <div role="alert" className="sa-error">
            {error}
          </div>
        )}
        <button type="submit" disabled={submitting} className="sa-btn">
          {submitting && <span className="sa-spin" aria-hidden="true" />}
          {submitting ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>
      <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid var(--sa-line)" }}>
        <BackToLogin />
      </div>
    </>
  );
}

function ConfirmResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/socialflow/auths/password-resets/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean } & ApiError;
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Algo salió mal.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <>
        <p className="sy-eyebrow-lite">Contraseña actualizada</p>
        <h1 className="sa-title">¡Listo!</h1>
        <p className="sa-sub" style={{ marginBottom: "1.5rem" }}>
          Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
        </p>
        <BackToLogin button />
      </>
    );
  }

  return (
    <>
      <p className="sy-eyebrow-lite">Nueva contraseña</p>
      <h1 className="sa-title">Crea una nueva contraseña</h1>
      <p className="sa-sub" style={{ marginBottom: "1.5rem" }}>Mínimo 8 caracteres.</p>
      <form onSubmit={handleSubmit} className="space-y-4" aria-busy={submitting}>
        <AuthField id="sa-new-password" label="Nueva contraseña">
          <PasswordInput
            id="sa-new-password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
        </AuthField>
        <AuthField id="sa-confirm-password" label="Confirmar contraseña">
          <PasswordInput
            id="sa-confirm-password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repite la contraseña"
          />
        </AuthField>
        {error && (
          <div role="alert" className="sa-error">
            {error}
          </div>
        )}
        <button type="submit" disabled={submitting} className="sa-btn">
          {submitting && <span className="sa-spin" aria-hidden="true" />}
          {submitting ? "Actualizando..." : "Actualizar contraseña"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  return (
    <Card>
      {token ? <ConfirmResetForm token={token} /> : <RequestResetForm />}
    </Card>
  );
}
