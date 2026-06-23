"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type ApiError = { message?: string; error?: string };

const inputCls =
  "mt-1.5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20";
const labelCls = "block text-sm font-semibold text-white/70";
const btnCls =
  "w-full rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3.5 text-sm font-black tracking-wide text-white shadow-lg shadow-violet-500/25 transition hover:brightness-110 hover:shadow-violet-500/40 disabled:cursor-not-allowed disabled:opacity-50";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030312] text-white">
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-15%] top-[-10%] h-[500px] w-[500px] rounded-full bg-violet-600/25 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] h-[400px] w-[400px] rounded-full bg-fuchsia-600/20 blur-[100px]" />
        <div className="absolute left-[40%] top-[50%] h-[300px] w-[300px] rounded-full bg-blue-600/15 blur-[90px]" />
      </div>

      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)", backgroundSize: "32px 32px" }}
      />

      <section className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 py-16">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-3 self-start">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-black shadow-lg shadow-violet-500/30">
            SF
          </div>
          <span className="text-xl font-black tracking-tight">
            Social<span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Flow</span>
          </span>
        </div>

        <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-7 shadow-2xl shadow-violet-900/20 backdrop-blur-sm sm:p-9">
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
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-violet-400">Email enviado</div>
        <h2 className="mb-4 text-2xl font-black tracking-tight text-white">Revisa tu bandeja</h2>
        <p className="mb-6 text-sm leading-6 text-white/50">
          Si existe una cuenta con ese email, recibirás un enlace para restablecer tu contraseña. Caduca en 1 hora.
        </p>
        <Link href="/socialflow/auth" className="text-sm font-semibold text-violet-400 transition hover:text-violet-300">
          ← Volver al inicio de sesión
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-violet-400">Recuperar acceso</div>
      <h2 className="mb-2 text-2xl font-black tracking-tight text-white">Restablece tu contraseña</h2>
      <p className="mb-6 text-sm leading-6 text-white/50">
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
            placeholder="tu@empresa.com"
          />
        </label>
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
            {error}
          </div>
        )}
        <button type="submit" disabled={submitting} className={btnCls}>
          {submitting ? "Enviando..." : "Enviar enlace"}
        </button>
      </form>
      <div className="mt-5 border-t border-white/8 pt-4">
        <Link href="/socialflow/auth" className="text-sm font-semibold text-violet-400 transition hover:text-violet-300">
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
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-violet-400">Contraseña actualizada</div>
        <h2 className="mb-4 text-2xl font-black tracking-tight text-white">¡Listo!</h2>
        <p className="mb-6 text-sm leading-6 text-white/50">
          Tu contraseña ha sido actualizada correctamente. Ya puedes iniciar sesión con tu nueva contraseña.
        </p>
        <Link
          href="/socialflow/auth"
          className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-3.5 text-sm font-black tracking-wide text-white shadow-lg shadow-violet-500/25 transition hover:brightness-110"
        >
          Ir al inicio de sesión
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-violet-400">Nueva contraseña</div>
      <h2 className="mb-2 text-2xl font-black tracking-tight text-white">Crea una nueva contraseña</h2>
      <p className="mb-6 text-sm leading-6 text-white/50">Mínimo 8 caracteres.</p>
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
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
            {error}
          </div>
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
