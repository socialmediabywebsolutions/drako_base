"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";

type AuthMode = "login" | "register";

export function AuthForm() {
    const [mode, setMode] = useState<AuthMode>("login");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form States
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError(null);
        await signIn("google", { callbackUrl: "/site/panel" });
    };

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (mode === "register") {
                // 1. Register via Internal API (through proxy to avoid exposing secret? No, we need a public proxy or server action).
                // WAIT. Browser cannot call internal/auth/* directly because it needs X-Drako-Origin-Secret.
                // We need a Next.js API Route/Server Action to proxy this safely.
                // Or we update the CredentialsProvider logic? CredentialsProvider handles Login.
                // Registration needs a public endpoint. 
                // Let's call a new Next.js public API route `/api/auth/register` which calls the Worker.

                const res = await fetch("/api/auth/register", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password, name }),
                });

                const data = await res.json() as { error?: string };
                if (!res.ok) throw new Error(data.error || "Registration failed");

                // Auto login after register
                setMode("login");
                setError("Account created! Please log in.");
                setLoading(false);
                return;
            }

            // Login Mode
            const res = await signIn("credentials", {
                redirect: false,
                email,
                password,
                callbackUrl: "/site/panel"
            });

            if (res?.error) {
                throw new Error("Invalid credentials");
            }

            if (res?.ok) {
                window.location.href = "/site/panel";
            }
        } catch (err: any) {
            setError(err.message);
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
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === "login"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                        }`}
                >
                    Login
                </button>
                <button
                    onClick={() => setMode("register")}
                    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === "register"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                        }`}
                >
                    Register
                </button>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
                {mode === "register" && (
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">NAME</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 text-sm outline-none transition-all"
                            placeholder="John Doe"
                        />
                    </div>
                )}

                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">EMAIL</label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 text-sm outline-none transition-all"
                        placeholder="you@company.com"
                    />
                </div>

                <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">PASSWORD</label>
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-sky-500 text-sm outline-none transition-all"
                        placeholder="••••••••"
                        minLength={8}
                    />
                </div>

                {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg font-medium">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-slate-900 text-white font-semibold py-2.5 rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                    {loading ? "Processing..." : (mode === "login" ? "Sign In" : "Create Account")}
                </button>
            </form>

            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-white text-slate-400 font-medium">OR</span>
                </div>
            </div>

            <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
            >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                Continue with Google
            </button>
        </div>
    );
}
