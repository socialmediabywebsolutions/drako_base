"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type ApiError = { message?: string; error?: string };

const inputCls =
  "mt-2 w-full rounded-md border border-[#cfd7c6] bg-white px-4 py-3 text-[#111827] outline-none transition placeholder:text-[#9aa49a] focus:border-[#153b39] focus:ring-4 focus:ring-[#dff5b2]";
const labelCls = "block text-sm font-semibold text-[#26332f]";
const btnCls =
  "w-full rounded-md bg-[#153b39] px-5 py-3.5 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#0f2d2c] disabled:cursor-not-allowed disabled:bg-[#95a39d]";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f5f7f2] text-[#111827]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(135deg,#0f2a2f_0%,#163b38_42%,#dbe7c5_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,24,39,0.05)_1px,transparent_1px),linear-gradient(180deg,rgba(17,24,39,0.04)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>
      <section className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 py-10">
        <div className="mb-8 flex items-center gap-3 self-start">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-sm font-black tracking-tight text-white shadow-sm backdrop-blur">
            SF
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.34em] text-[#dceec6]">SocialFlow</p>
            <p className="text-sm text-white/70">AI social operating system</p>
          </div>
        </div>
        <div className="w-full rounded-lg border border-[#d8decd] bg-[#fffdf7] p-7 shadow-[0_26px_70px_rgba(17,24,39,0.14)]">
          {children}
        </div>
      </section>
    </main>
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
        throw new Error(data.message ?? data.error ?? "Something went wrong.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <>
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-[#75806f]">Email enviado</div>
        <h2 className="mb-4 text-2xl font-semibold tracking-[-0.04em] text-[#111827]">Revisa tu bandeja</h2>
        <p className="mb-6 text-sm leading-6 text-[#5f685d]">
          Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña. Caduca en 1 hora.
        </p>
        <Link
          href="/socialflow/auth"
          className="text-sm font-semibold text-[#153b39] hover:underline"
        >
          ← Volver al inicio de sesión
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-[#75806f]">Recuperar acceso</div>
      <h2 className="mb-2 text-2xl font-semibold tracking-[-0.04em] text-[#111827]">Restablece tu contraseña</h2>
      <p className="mb-6 text-sm leading-6 text-[#5f685d]">
        Introduce tu email y te enviaremos un enlace para crear una nueva contraseña.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className={labelCls}>
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="you@company.com"
          />
        </label>
        {error && (
          <p className="rounded-md border border-[#f2b6a0] bg-[#fff0e8] px-4 py-3 text-sm font-semibold text-[#973b18]">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting} className={btnCls}>
          {submitting ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>
      <div className="mt-5 border-t border-[#d8decd] pt-4">
        <Link href="/socialflow/auth" className="text-sm font-semibold text-[#153b39] hover:underline">
          ← Volver al inicio de sesión
        </Link>
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
        throw new Error(data.message ?? data.error ?? "Something went wrong.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <>
        <div className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-[#75806f]">Contraseña actualizada</div>
        <h2 className="mb-4 text-2xl font-semibold tracking-[-0.04em] text-[#111827]">¡Listo!</h2>
        <p className="mb-6 text-sm leading-6 text-[#5f685d]">
          Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
        </p>
        <Link
          href="/socialflow/auth"
          className={btnCls.replace("w-full", "inline-block text-center")}
        >
          Ir al inicio de sesión
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-[#75806f]">Nueva contraseña</div>
      <h2 className="mb-2 text-2xl font-semibold tracking-[-0.04em] text-[#111827]">Crea una nueva contraseña</h2>
      <p className="mb-6 text-sm leading-6 text-[#5f685d]">Mínimo 8 caracteres.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className={labelCls}>
          Nueva contraseña
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
            placeholder="Mínimo 8 caracteres"
          />
        </label>
        <label className={labelCls}>
          Confirmar contraseña
          <input
            required
            type="password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputCls}
            placeholder="Repite la contraseña"
          />
        </label>
        {error && (
          <p className="rounded-md border border-[#f2b6a0] bg-[#fff0e8] px-4 py-3 text-sm font-semibold text-[#973b18]">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting} className={btnCls}>
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
