"use client";

import { ProductAuthForm } from "@/components/auth/product-auth-form";

// Bug fijo 2026-08-24: esta página redirigía a /auth/login, que a su vez redirige
// aquí para el contexto "drakos" (bucle infinito, nunca renderizaba nada) — ver
// resolveDestination() en src/app/auth/login/page.tsx. Mismo componente reutilizable
// (ProductAuthForm) que ya usan mentorias/bases, apuntado al contexto "drakos"
// (/api/drakos/auths/logins|registrations, ya verificados en producción).
const drakosAuthCopy = {
  loginTab: "Entrar",
  registerTab: "Crear cuenta",
  nameLabel: "Nombre",
  emailLabel: "Email",
  passwordLabel: "Contraseña",
  namePlaceholder: "Tu nombre",
  emailPlaceholder: "tu@email.com",
  passwordPlaceholder: "********",
  loadingLabel: "Entrando...",
  loginSubmit: "Entrar",
  registerSubmit: "Crear cuenta",
} as const;

export default function DrakosLoginsPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <ProductAuthForm
        title="Drako Systems"
        description="Acceso de plataforma — operator, factory y control interno."
        authApiBase="/api/drakos/auths"
        defaultMode="login"
        allowRegister
        postLoginRedirect="/operator/socialflow"
        copy={drakosAuthCopy}
      />
    </div>
  );
}
