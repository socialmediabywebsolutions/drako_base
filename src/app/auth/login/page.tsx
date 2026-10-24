import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveAuthsContextFromHost } from "@/lib/auths/contexts";
import { normalizeHost } from "@/lib/hosts";
import { ProductAuthForm } from "@/components/auth/product-auth-form";

type LegacyAuthPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveSearchParam(value: string | string[] | undefined): string | null {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? value[0] ?? null : null;
}

function resolveDestination(context: ReturnType<typeof resolveAuthsContextFromHost>) {
  if (context === "bases") return "/bases/login";
  if (context === "mentorias") return "/mentorias/auths/logins";
  if (context === "socialflow") return "/socialflow/auth";
  return "/drakos/auths/logins";
}

// Bug fijo 2026-08-24: src/app/drakos/auths/logins/page.tsx redirige aquí a
// propósito (lo exige el guardrail SSOT en scripts/lib/auth-ssot-audit.ts — no se
// toca esa página). Antes, este archivo redirigía OTRA VEZ a /drakos/auths/logins
// para el contexto "drakos" (el mismo resolveDestination() de abajo) — bucle
// infinito, nunca renderizaba nada. "drakos" es el único contexto sin una página de
// producto propia con formulario real (bases/mentorias/socialflow sí la tienen), así
// que este es el punto terminal correcto para él — los demás contextos siguen
// redirigiendo exactamente igual que antes.
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

// Auditoría de seguridad 2026-09-01: drako.systems es la superficie de founder/admin
// (/operator, /admin, /clients...), no un producto de autoservicio — no debe ofrecer
// un formulario de registro público. allowRegister={false} quita la pestaña "Crear
// cuenta" y fuerza mode="login" (ProductAuthForm, product-auth-form.tsx:65). El
// endpoint /api/drakos/auths/registrations también se deshabilitó por separado (ver
// route.ts) para que un POST directo, sin pasar por esta UI, falle igual.

export default async function LegacyLoginPage({ searchParams }: LegacyAuthPageProps) {
  const params = (await searchParams) ?? {};
  const localOverrideHost = resolveSearchParam(params.__drako_host);
  const callbackUrl = resolveSearchParam(params.callbackUrl);
  const invite = resolveSearchParam(params.invite);
  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const requestedHost =
    localOverrideHost
    || requestHeaders.get("x-drako-effective-host")
    || cookieStore.get("drako_host")?.value
    || requestHeaders.get("x-forwarded-host")
    || requestHeaders.get("host");
  const normalizedHost = normalizeHost(requestedHost ?? "");
  const isAmbiguousLocalHost = !localOverrideHost && (normalizedHost === "localhost" || normalizedHost === "127.0.0.1");

  if (isAmbiguousLocalHost) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
        <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-sky-200">Explicit context required</div>
          <h1 className="mt-4 text-3xl font-black">Local auth no longer falls back to Drakos.</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Use an explicit host context in local development: `?__drako_host=bases.drako.systems`, `?__drako_host=drako.systems`,
            `?__drako_host=mentorias.drako.systems` or an explicit Socialcors host.
          </p>
        </div>
      </div>
    );
  }

  const context = resolveAuthsContextFromHost(requestedHost);

  if (context === "drakos") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <ProductAuthForm
          title="Drako Systems"
          description="Acceso de plataforma — operator, factory y control interno."
          authApiBase="/api/drakos/auths"
          defaultMode="login"
          allowRegister={false}
          postLoginRedirect="/operator/socialflow"
          copy={drakosAuthCopy}
        />
      </div>
    );
  }

  const target = new URL(resolveDestination(context), "http://localhost");
  if (callbackUrl) target.searchParams.set("callbackUrl", callbackUrl);
  if (invite) target.searchParams.set("invite", invite);
  if (localOverrideHost) target.searchParams.set("__drako_host", localOverrideHost);
  redirect(`${target.pathname}${target.search}`);
}
