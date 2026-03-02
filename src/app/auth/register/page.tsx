import { AuthForm } from "@/components/auth/auth-form";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveAuthsContextFromHost } from "@/lib/auths/contexts";

export default async function RegisterPage() {
    const requestHeaders = await headers();
    const requestedHost = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
    const context = resolveAuthsContextFromHost(requestedHost);

    if (context === "bases") {
        redirect("/auth/login");
    }

    const authApiBase = context === "mentorias" ? "/api/mentorias/auths" : "/api/drakos/auths";
    const saasSlug = context === "mentorias" ? "mentorias" : "drako";
    const postLoginRedirect = context === "mentorias" ? "/client/sessions" : "/site/onboarding";

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-slate-900">Crear cuenta</h1>
                    <p className="mt-2 text-slate-500">Únete a DRĀKO Systems y lanza tu plataforma.</p>
                </div>
                <AuthForm
                    defaultMode="register"
                    saasSlug={saasSlug}
                    authApiBase={authApiBase}
                    postLoginRedirect={postLoginRedirect}
                />
            </div>
        </div>
    );
}
