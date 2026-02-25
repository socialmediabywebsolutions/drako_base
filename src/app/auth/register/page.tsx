"use client";

import { AuthForm } from "@/components/auth/auth-form";

export default function RegisterPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-slate-900">Crear cuenta</h1>
                    <p className="mt-2 text-slate-500">Únete a DRĀKO Systems y lanza tu plataforma.</p>
                </div>
                <AuthForm defaultMode="register" context="drakos" redirectTo="/site/onboarding" />
            </div>
        </div>
    );
}
