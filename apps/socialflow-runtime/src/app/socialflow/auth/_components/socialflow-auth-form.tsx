"use client";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";

type SocialFlowAuthMode = "login" | "register";

type AuthResponseBody = {
  message?: string;
  error?: string;
  code?: string;
};

const commandSignals = [
  { label: "Calendar clarity", value: "18 drafts aligned" },
  { label: "Audience signal", value: "4 channels monitored" },
  { label: "AI planning", value: "7 ideas ready" },
];

const queueItems = [
  {
    title: "Launch week narrative",
    meta: "LinkedIn sequence",
    status: "Ready for review",
  },
  {
    title: "Founder insight post",
    meta: "Personal brand",
    status: "Tone matched",
  },
  {
    title: "Comment follow-up map",
    meta: "Relationship loop",
    status: "Queued",
  },
];

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

export default function SocialFlowAuthForm() {
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
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(
          mode === "login"
            ? { email, password }
            : { email, name, password },
        ),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as AuthResponseBody;
        throw new Error(payload.message || payload.error || payload.code || "Authentication failed.");
      }

      const redirectTarget = resolveSafeRedirectTarget(
        searchParams.get("callbackUrl") || searchParams.get("next"),
      );
      window.location.assign(redirectTarget);
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f2] text-[#111827]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(135deg,#0f2a2f_0%,#163b38_42%,#dbe7c5_100%)]" />
        <div className="absolute left-0 top-72 h-px w-full bg-[#d3d8ca]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(17,24,39,0.05)_1px,transparent_1px),linear-gradient(180deg,rgba(17,24,39,0.04)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-5 py-10 sm:px-8 lg:px-10">
        <div className="grid w-full gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="text-white">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-sm font-black tracking-tight shadow-sm backdrop-blur">
                SF
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.34em] text-[#dceec6]">
                  SocialFlow
                </p>
                <p className="text-sm text-white/70">AI social operating system</p>
              </div>
            </div>

            <div className="max-w-2xl">
              <p className="mb-4 inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[#f2ffd7] backdrop-blur">
                Private workspace access
              </p>
              <h1 className="text-balance text-5xl font-semibold leading-[0.96] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                Turn social chaos into a guided growth rhythm.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-white/78">
                Plan content, coordinate campaigns, read audience signals and keep
                every brand conversation moving from one focused command center.
              </p>
            </div>

            <div className="mt-10 rounded-lg border border-[#183d3c]/15 bg-[#fbfcf7] p-4 text-[#172421] shadow-[0_28px_80px_rgba(17,24,39,0.18)] sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8decd] pb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#5c6657]">
                    Live command preview
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                    Today&apos;s marketing flow
                  </h2>
                </div>
                <span className="rounded-full bg-[#dff5b2] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[#25320d]">
                  Staff gated
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {commandSignals.map((signal) => (
                  <div key={signal.label} className="rounded-md border border-[#d8decd] bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b7564]">
                      {signal.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#13211f]">{signal.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                {queueItems.map((item, index) => (
                  <div
                    key={item.title}
                    className="grid gap-3 rounded-md border border-[#d8decd] bg-[#f7f9f0] p-4 sm:grid-cols-[auto_1fr_auto] sm:items-center"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#153b39] text-sm font-bold text-[#e7ffd0]">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold tracking-[-0.02em] text-[#13211f]">{item.title}</p>
                      <p className="text-sm text-[#657064]">{item.meta}</p>
                    </div>
                    <p className="text-sm font-semibold text-[#2f6f55]">{item.status}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-lg border border-[#d8decd] bg-[#fffdf7] p-5 shadow-[0_26px_70px_rgba(17,24,39,0.14)] sm:p-7 lg:ml-auto lg:w-full lg:max-w-md">
            <div className="mb-7">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#75806f]">
                Secure access
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-[#111827]">
                {mode === "login" ? "Enter your workspace" : "Create your workspace"}
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#5f685d]">
                Use your SocialFlow identity to continue to the private marketing workspace.
              </p>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-md border border-[#d8decd] bg-[#eef2e6] p-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded px-4 py-2.5 text-sm font-bold transition ${
                  mode === "login"
                    ? "bg-[#153b39] text-white shadow-sm"
                    : "text-[#52604f] hover:text-[#111827]"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`rounded px-4 py-2.5 text-sm font-bold transition ${
                  mode === "register"
                    ? "bg-[#153b39] text-white shadow-sm"
                    : "text-[#52604f] hover:text-[#111827]"
                }`}
              >
                Create
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" ? (
                <label className="block text-sm font-semibold text-[#26332f]">
                  Name
                  <input
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-2 w-full rounded-md border border-[#cfd7c6] bg-white px-4 py-3 text-[#111827] outline-none transition placeholder:text-[#9aa49a] focus:border-[#153b39] focus:ring-4 focus:ring-[#dff5b2]"
                    placeholder="Alex Rivera"
                  />
                </label>
              ) : null}

              <label className="block text-sm font-semibold text-[#26332f]">
                Email
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-md border border-[#cfd7c6] bg-white px-4 py-3 text-[#111827] outline-none transition placeholder:text-[#9aa49a] focus:border-[#153b39] focus:ring-4 focus:ring-[#dff5b2]"
                  placeholder="you@company.com"
                />
              </label>

              <label className="block text-sm font-semibold text-[#26332f]">
                Password
                <input
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 w-full rounded-md border border-[#cfd7c6] bg-white px-4 py-3 text-[#111827] outline-none transition placeholder:text-[#9aa49a] focus:border-[#153b39] focus:ring-4 focus:ring-[#dff5b2]"
                  placeholder="Your secure password"
                />
              </label>

              {error ? (
                <p className="rounded-md border border-[#f2b6a0] bg-[#fff0e8] px-4 py-3 text-sm font-semibold text-[#973b18]">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-md bg-[#153b39] px-5 py-3.5 text-sm font-black uppercase tracking-[0.18em] text-white transition hover:bg-[#0f2d2c] disabled:cursor-not-allowed disabled:bg-[#95a39d]"
              >
                {isSubmitting
                  ? "Securing access..."
                  : mode === "login"
                    ? "Continue to SocialFlow"
                    : "Create SocialFlow access"}
              </button>
            </form>

            <div className="mt-6 border-t border-[#d8decd] pt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#74806d]">
                Runtime contract preserved
              </p>
              <p className="mt-2 text-sm leading-6 text-[#5f685d]">
                Authentication stays on the existing SocialFlow API boundary. No social login,
                payment flow or external tracker is introduced here.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
