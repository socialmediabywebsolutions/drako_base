"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { getAuthTexts, AuthLang } from "@/lib/i18n/auth-i18n";

type AuthMode = "login" | "register";
type AuthSaasSlug = "drako" | "mentorias" | "campo_base";

type InviteHint = {
  email: string;
  tenantName: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

export function AuthForm({
  defaultMode = "login",
  lang = "es",
  saasSlug,
  authApiBase,
  postLoginRedirect,
  inviteHint,
  allowRegistration = true,
  registrationLabel,
  enableGoogleAuth = false,
  googleButtonLabel,
}: {
  defaultMode?: AuthMode;
  lang?: AuthLang;
  saasSlug: AuthSaasSlug;
  authApiBase: string;
  postLoginRedirect: string;
  inviteHint?: InviteHint | null;
  allowRegistration?: boolean;
  registrationLabel?: string;
  enableGoogleAuth?: boolean;
  googleButtonLabel?: string;
}) {
  const t = getAuthTexts(lang);
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const callbackUrl = searchParams.get("callbackUrl");
  const redirectTarget = callbackUrl || postLoginRedirect;
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [errorData, setErrorData] = useState<{ correlationId?: string } | null>(null);
  const [email, setEmail] = useState(inviteHint?.email ?? "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");

  const isWorkspaceAuth = saasSlug === "campo_base";
  const isInviteFlow = Boolean(inviteToken);
  const readOnlyInviteEmail = Boolean(inviteHint?.email);
  const resolvedRegistrationLabel = registrationLabel ?? (isWorkspaceAuth ? "Workspace setup" : t.register);
  const resolvedGoogleButtonLabel = googleButtonLabel ?? t.google;

  if (saasSlug === "drako" && authApiBase !== "/api/drakos/auths") {
    throw new Error("AUTH_FORM_CONFIG_MISMATCH: drako must use /api/drakos/auths");
  }
  if (saasSlug === "mentorias" && authApiBase !== "/api/mentorias/auths") {
    throw new Error("AUTH_FORM_CONFIG_MISMATCH: mentorias must use /api/mentorias/auths");
  }
  if (saasSlug === "campo_base" && authApiBase !== "/api/auth/workspace") {
    throw new Error("AUTH_FORM_CONFIG_MISMATCH: campo_base must use /api/auth/workspace");
  }

  const primaryButtonLabel = useMemo(() => {
    if (mode === "login") return "Enter workspace";
    if (isInviteFlow) return "Accept invite";
    if (isWorkspaceAuth) return "Create workspace";
    return t.register;
  }, [isInviteFlow, isWorkspaceAuth, mode, t.register]);

  const handleGoogleLogin = async () => {
    if (!enableGoogleAuth) {
      setError("Google sign-in is unavailable in this access surface.");
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    await signIn("google", { callbackUrl: redirectTarget });
  };

  async function loginIntoWorkspace() {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: redirectTarget,
    });
    if (!result || result.error) {
      throw new Error(t.errors.INVALID_CREDENTIALS);
    }
    return result.url || redirectTarget;
  }

  async function handleWorkspaceInviteAfterLogin() {
    const acceptResponse = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: inviteToken }),
    });
    if (!acceptResponse.ok) {
      const acceptData = (await acceptResponse.json().catch(() => ({}))) as { code?: string };
      throw new Error(acceptData.code ?? "INVITE_ACCEPT_FAILED");
    }
  }

  async function handleWorkspaceRegistration() {
    if (isInviteFlow) {
      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: inviteToken,
          email,
          password,
          name,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { code?: string };
      if (!response.ok) {
        throw new Error(payload.code ?? t.errors.generic);
      }
      window.location.href = redirectTarget;
      return;
    }

    const response = await fetch(`${authApiBase}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        name,
        workspaceName,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { code?: string; correlationId?: string };
    if (!response.ok) {
      setErrorData({ correlationId: payload.correlationId });
      throw new Error((payload.code && t.errors[payload.code as keyof typeof t.errors]) || payload.code || t.errors.generic);
    }

    const signedInUrl = await loginIntoWorkspace();
    window.location.href = signedInUrl;
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setErrorData(null);

    try {
      if (mode === "register") {
        if (isWorkspaceAuth) {
          await handleWorkspaceRegistration();
          return;
        }

        const res = await fetch(`${authApiBase}/registrations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string; message?: string; correlationId?: string };
        if (!res.ok) {
          setErrorData({ correlationId: data.correlationId });
          throw new Error(data.message || (data.code && t.errors[data.code as keyof typeof t.errors]) || t.errors.generic);
        }

        window.location.href = redirectTarget;
        return;
      }

      if (isWorkspaceAuth) {
        const signedInUrl = await loginIntoWorkspace();
        if (isInviteFlow) {
          await handleWorkspaceInviteAfterLogin();
        }
        window.location.href = signedInUrl;
        return;
      }

      const loginResponse = await fetch(`${authApiBase}/logins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const loginData = (await loginResponse.json().catch(() => ({}))) as { code?: string; message?: string };
      if (!loginResponse.ok) {
        if (loginData.code === "INVALID_CREDENTIALS") throw new Error(t.errors.INVALID_CREDENTIALS);
        throw new Error(loginData.message || t.errors.generic);
      }

      window.location.href = redirectTarget;
    } catch (err: any) {
      setError(err.message || t.errors.generic);
      console.error("AUTH_FORM_ERROR", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6 flex rounded-2xl border border-slate-200 bg-slate-100/80 p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] transition-all ${
            mode === "login" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {t.login}
        </button>
        {allowRegistration ? (
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-[0.2em] transition-all ${
              mode === "register" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {resolvedRegistrationLabel}
          </button>
        ) : null}
      </div>

      {isInviteFlow && inviteHint ? (
        <div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-slate-700">
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-700">Workspace invite</div>
          <div className="mt-2 font-semibold text-slate-900">{inviteHint.tenantName}</div>
          <div className="mt-1 text-slate-600">Role: {inviteHint.role}</div>
          <div className="mt-1 text-slate-600">Email: {inviteHint.email}</div>
        </div>
      ) : null}

      <form onSubmit={handleEmailAuth} className="space-y-4">
        {mode === "register" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className={isWorkspaceAuth && !isInviteFlow ? "" : "md:col-span-2"}>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">{t.name}</label>
              <input
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
                placeholder="Ada Lovelace"
              />
            </div>
            {isWorkspaceAuth && !isInviteFlow ? (
              <div>
                <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">Workspace name</label>
                <input
                  type="text"
                  required
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
                  placeholder="Northstar Growth"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">{t.email}</label>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={readOnlyInviteEmail}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 read-only:bg-slate-50 read-only:text-slate-500"
            placeholder="operator@company.com"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">{t.password}</label>
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
            placeholder="••••••••"
            minLength={8}
          />
          {mode === "register" ? (
            <p className="mt-2 text-xs text-slate-500">
              Use at least 8 characters. This password will secure your Campamento Base workspace session.
            </p>
          ) : null}
        </div>

        {success ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {success}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <div>{error}</div>
            {errorData?.correlationId ? (
              <div className="mt-3 border-t border-red-100 pt-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-400">Support ID</div>
                <code className="mt-1 block break-all rounded bg-white/70 px-2 py-1 text-[10px]">{errorData.correlationId}</code>
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t.processing : primaryButtonLabel}
        </button>
      </form>

      {enableGoogleAuth ? (
        <>
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{t.or}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="h-4 w-4 opacity-80" />
            {resolvedGoogleButtonLabel}
          </button>
        </>
      ) : null}
    </div>
  );
}
