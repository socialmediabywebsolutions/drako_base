"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

// Login privado del panel de drako.systems. Sin registro ni recuperación: un único
// operator. POST /api/operator-login y vuelta a ?next= (solo rutas internas).

function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/operator";
}

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/operator-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Credenciales incorrectas");
      window.location.assign(safeNext(searchParams.get("next")));
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Credenciales incorrectas");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_8px_32px_rgba(15,23,42,0.08)]">
      <p className="mb-8 text-center text-3xl font-black tracking-[0.25em] text-[#3b82f6]">DRAKO</p>

      <label className="block text-xs font-semibold text-slate-500">
        Email
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#3b82f6] focus:outline-none"
        />
      </label>

      <label className="mt-4 block text-xs font-semibold text-slate-500">
        Contraseña
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#3b82f6] focus:outline-none"
        />
      </label>

      {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-xl bg-[#3b82f6] py-2.5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60"
      >
        {loading ? "Accediendo…" : "Acceder"}
      </button>
    </form>
  );
}

export default function OperatorLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
