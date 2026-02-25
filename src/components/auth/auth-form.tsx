"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { getAuthTexts, AuthLang } from "@/lib/i18n/auth-i18n";

type AuthMode = "login" | "register";

export function AuthForm({ defaultMode = "login", lang = "es" }: { defaultMode?: AuthMode; lang?: AuthLang }) {
    const t = getAuthTexts(lang);
    const [mode, setMode] = useState<AuthMode>(defaultMode);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorData, setErrorData] = useState<{ correlationId?: string } | null>(null);

    // Form States
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        await signIn("google", { callbackUrl: "/site/onboarding" });
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (mode === "register") {
                const res = await fetch("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password, name }),
                });

                const data = await res.json() as { error?: string, code?: string, message?: string, correlationId?: string };
                if (!res.ok) {
                    setErrorData({ correlationId: data.correlationId });
                    const displayMessage = data.message || (data.code && t.errors[data.code as keyof typeof t.errors]) || t.errors.generic;
                    throw new Error(displayMessage);
                }

                // Auto login after register
                const loginRes = await signIn("credentials", {
                    redirect: false,
                    email,
                    password,
                });

                if (loginRes?.ok) {
                    window.location.href = "/site/onboarding";
                } else {
                    setMode("login");
                    setError(t.success_register);
                    setLoading(false);
                }
                return;
            }

            // Login Mode
            const res = await signIn("credentials", {
                redirect: false,
                email,
                password,
            });

            if (res?.error) {
                if (res.error === "CredentialsSignin") {
                    throw new Error(t.errors.INVALID_CREDENTIALS);
                }
                throw new Error(t.errors.generic);
            }

            if (res?.ok) {
                // Official Flow Start: Onboarding
                window.location.href = "/site/onboarding";
            }
        } catch (err: any) {
            setError(err.message || t.errors.generic);
            console.error("AUTH_FORM_ERROR", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-sm">
            {/* Tabs */}
            <div className="flex mb-6 bg-slate-100 p-1 rounded-xl">
                <button
                    onClick={() => setMode("login")}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${mode === "login"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                        }`}
                >
                    {t.login}
                </button>
                <button
                    onClick={() => setMode("register")}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${mode === "register"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                        }`}
                >
                    {t.register}
                </button>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
                {mode === "register" && (
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">{t.name}</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm outline-none transition-all placeholder:text-slate-300"
                            placeholder="John Doe"
                        />
                    </div>
                )}

                <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">{t.email}</label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm outline-none transition-all placeholder:text-slate-300"
                        placeholder="email@ejemplo.com"
                    />
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-widest">{t.password}</label>
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm outline-none transition-all placeholder:text-slate-300"
                        placeholder="••••••••"
                        minLength={8}
                    />
                </div>

                {error && (
                    <div className={`p-4 text-xs rounded-xl font-semibold border transition-all animate-in fade-in slide-in-from-top-1 ${error === t.success_register
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                        : "bg-red-50 text-red-600 border-red-100"
                        }`}>
                        <div className="flex items-start gap-2">
                            <span className="flex-1">{error}</span>
                        </div>
                        {errorData?.correlationId && (
                            <div className="mt-2 pt-2 border-t border-red-100/50 flex flex-col gap-1">
                                <span className="text-[10px] text-red-400 uppercase tracking-widest font-bold">ID de diagnóstico</span>
                                <code className="text-[10px] bg-white/50 p-1 rounded font-mono break-all select-all">
                                    {errorData.correlationId}
                                </code>
                            </div>
                        )}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
                >
                    {loading ? t.processing : (mode === "login" ? t.login : t.register)}
                </button>
            </form>

            <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-100"></div>
                </div>
                <div className="relative flex justify-center text-[10px] font-bold tracking-widest uppercase">
                    <span className="px-4 bg-white text-slate-400">{t.or}</span>
                </div>
            </div>

            <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-600 font-bold py-3.5 rounded-xl hover:bg-slate-50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
            >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 opacity-80" />
                {t.google}
            </button>
        </div>
    );
}
