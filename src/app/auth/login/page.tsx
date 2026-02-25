"use client";

import { AuthForm } from "@/components/auth/auth-form";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-sky-50 to-slate-100 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-10 border border-slate-200">
                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <Image
                        src="/logo-drako-full.png"
                        alt="Drako Systems"
                        width={180}
                        height={70}
                        className="object-contain h-14 w-auto"
                        priority
                    />
                </div>

                {/* Heading */}
                <h1 className="text-2xl font-black text-slate-900 text-center mb-2">
                    Bienvenido a Drako
                </h1>
                <p className="text-slate-500 text-center mb-8 text-sm">
                    Inicia sesión o crea una cuenta
                </p>

                {/* Unified Auth Form */}
                <AuthForm context="drakos" redirectTo="/site/onboarding" />

                {/* Back to home */}
                <Link
                    href="/site"
                    className="block w-full text-center text-xs font-medium text-sky-600 hover:text-sky-700 transition-colors mt-6"
                >
                    Volver al inicio
                </Link>
            </div>
        </div>
    );
}
