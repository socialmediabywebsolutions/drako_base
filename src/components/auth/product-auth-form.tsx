"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

type ProductAuthMode = "login" | "register";

export function ProductAuthForm({
  authApiBase,
  postLoginRedirect,
  defaultMode = "login",
  title,
  description,
}: {
  authApiBase: string;
  postLoginRedirect: string;
  defaultMode?: ProductAuthMode;
  title: string;
  description: string;
}) {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const redirectTarget = callbackUrl || postLoginRedirect;
  const [mode, setMode] = useState<ProductAuthMode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const endpoint = mode === "login" ? `${authApiBase}/logins` : `${authApiBase}/registrations`;
      const payload = mode === "login" ? { email, password } : { email, password, name };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => ({}))) as { message?: string; code?: string; error?: string };
      if (!response.ok) {
        throw new Error(body.message || body.code || body.error || "Authentication failed.");
      }

      window.location.href = redirectTarget;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950/90 p-6 text-white shadow-2xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      </div>

      <div className="mb-6 flex rounded-2xl border border-slate-800 bg-slate-900 p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] ${
            mode === "login" ? "bg-white text-slate-950" : "text-slate-400"
          }`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`flex-1 rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] ${
            mode === "register" ? "bg-white text-slate-950" : "text-slate-400"
          }`}
        >
          Register
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "register" ? (
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-sky-500"
              placeholder="Ada Lovelace"
            />
          </div>
        ) : null}

        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-sky-500"
            placeholder="operator@company.com"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-sky-500"
            placeholder="********"
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-sky-500 px-5 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
        >
          {loading ? "Processing..." : mode === "login" ? "Enter workspace" : "Create workspace"}
        </button>
      </form>
    </div>
  );
}
