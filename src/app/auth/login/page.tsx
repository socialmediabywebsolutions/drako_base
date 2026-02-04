"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        // Get callbackUrl from URL search params or fallback to site panel
        const params = new URLSearchParams(window.location.search);
        const callbackUrl = params.get("callbackUrl") || "/site/panel";
        await signIn("google", { callbackUrl });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-slate-100 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-10 border border-slate-200">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <Image
                        src="/logo-drako-full.png"
                        alt="Drako Systems"
                        width={200}
                        height={80}
                        className="object-contain h-16 w-auto"
                    />
                </div>

                {/* Heading */}
                <h1 className="text-3xl font-black text-slate-900 text-center mb-2">
                    Bienvenido a Drako
                </h1>
                <p className="text-slate-500 text-center mb-8">
                    Inicia sesión para acceder a tu panel
                </p>

                {/* Google Button */}
                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-300 text-slate-700 font-semibold py-3 px-6 rounded-xl hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <>
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Continuar con Google
                        </>
                    )}
                </button>

                {/* Divider */}
                <div className="relative my-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                        <span className="px-2 bg-white text-slate-500 font-medium">o</span>
                    </div>
                </div>

                {/* Back to home */}
                <Link
                    href="/site"
                    className="block w-full text-center text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors"
                >
                    Volver al inicio
                </Link>
            </div>
        </div>
    );
}
