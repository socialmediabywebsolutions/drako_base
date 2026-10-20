"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "../../_components/auth-shell";
import { AuthField, PasswordInput } from "../../_components/auth-fields";

type ApiError = { message?: string; error?: string };

function BackToLogin({ button = false }: { button?: boolean }) {
  return button ? (
    <Link
      href="/socialflow/planes"
      className="inline-flex items-center justify-center w-full min-h-[3rem] px-6 py-3 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] hover:brightness-110 text-white text-sm font-bold shadow-lg transition"
      style={{ textDecoration: "none" }}
    >
      Ir al inicio de sesión
    </Link>
  ) : (
    <Link href="/socialflow/planes" className="text-xs font-bold text-[#3b82f6] hover:underline underline-offset-3">
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
      <div className="space-y-4">
        <p className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-[#3b82f6]">Email enviado</p>
        <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">Revisa tu bandeja</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña. Caduca en 1 hora.
        </p>
        <BackToLogin />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-[#3b82f6]">Recuperar acceso</p>
        <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">Restablece tu contraseña</h1>
        <p className="text-sm text-slate-500 leading-relaxed pt-1">
          Introduce tu email y te enviaremos un enlace para crear una nueva contraseña.
        </p>
      </div>
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
            className="block w-full min-h-[2.75rem] px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm outline-none transition focus:border-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6]/20 placeholder:text-slate-400"
            placeholder="tu@empresa.com"
          />
        </AuthField>
        {error && (
          <div role="alert" className="px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 w-full min-h-[3rem] px-6 py-3 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] hover:brightness-110 text-white text-sm font-extrabold shadow-lg shadow-[#3b82f6]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting && (
            <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" />
          )}
          {submitting ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>
      <div className="pt-4 border-t border-slate-100">
        <BackToLogin />
      </div>
    </div>
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
      <div className="space-y-4">
        <p className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-[#3b82f6]">Contraseña actualizada</p>
        <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">¡Listo!</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
        </p>
        <BackToLogin button />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-[#3b82f6]">Nueva contraseña</p>
        <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">Crea una nueva contraseña</h1>
        <p className="text-sm text-slate-500 leading-relaxed pt-1">Mínimo 8 caracteres.</p>
      </div>
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
          <div role="alert" className="px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-600">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center gap-2 w-full min-h-[3rem] px-6 py-3 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] hover:brightness-110 text-white text-sm font-extrabold shadow-lg shadow-[#3b82f6]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting && (
            <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" />
          )}
          {submitting ? "Actualizando..." : "Actualizar contraseña"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  return (
    <AuthShell>
      <div className="animate-[fadeUp_0.45s_ease_both]">
        {token ? <ConfirmResetForm token={token} /> : <RequestResetForm />}
      </div>
    </AuthShell>
  );
}
