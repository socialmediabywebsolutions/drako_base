"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

// ── Icons ──────────────────────────────────────────────────────────────────────
function IcoHome() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4.5 w-4.5 h-[18px] w-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>;
}
function IcoSparkles() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" /></svg>;
}
function IcoChat() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" /></svg>;
}
function IcoUsers() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg>;
}
function IcoCalendar() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>;
}
function IcoBook() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>;
}
function IcoCog() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>;
}
function IcoLogout() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" /></svg>;
}
function IcoCamera() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" /></svg>;
}
function IcoUser() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.964 0a9 9 0 1 0-11.964 0m11.964 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>;
}
function IcoNetwork() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-9.686a2.25 2.25 0 1 0 3.935-2.186 2.25 2.25 0 0 0-3.935 2.186Z" /></svg>;
}
function IcoTarget() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" /></svg>;
}
function IcoChevron({ open }: { open: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>;
}
function IcoPublish() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-[18px] w-[18px]"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /></svg>;
}

// ── Nav structure ───────────────────────────────────────────────────────────────
const mainNavTop = [
  { href: "/socialflow",               label: "Dashboard",           icon: <IcoHome /> },
  { href: "/socialflow/profile",       label: "Mi Perfil",           icon: <IcoUser /> },
  { href: "/socialflow/upload",        label: "Subir foto",          icon: <IcoCamera /> },
];

const mainNavBottom = [
  { href: "/socialflow/plan",           label: "Plan editorial",      icon: <IcoCalendar /> },
  { href: "/socialflow/campaigns",      label: "Campañas",            icon: <IcoTarget /> },
  { href: "/socialflow/redes",          label: "Mis Redes",           icon: <IcoNetwork /> },
  { href: "/socialflow/conversations", label: "Comunidad",           icon: <IcoChat /> },
  { href: "/socialflow/leads",         label: "Oportunidades",       icon: <IcoUsers /> },
  { href: "/socialflow/knowledge",     label: "Base de conocimiento",icon: <IcoBook /> },
];

const settingsNav = [
  { href: "/socialflow/settings/account",   label: "Mi cuenta" },
  { href: "/socialflow/settings/accounts",  label: "Cuentas sociales" },
  { href: "/socialflow/settings/team",      label: "Equipo" },
  { href: "/socialflow/settings/billing",   label: "Facturación" },
  { href: "/socialflow/settings/ownership", label: "Propiedad" },
];

function renderMainNavItem(item: { href: string; label: string; icon: React.ReactNode }, active: boolean) {
  return (
    <Link
      key={item.href}
      href={item.href}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
        active
          ? "bg-gradient-to-r from-violet-500/20 to-fuchsia-500/10 text-white border border-violet-500/25"
          : "text-white/45 hover:bg-white/5 hover:text-white/80 border border-transparent"
      }`}
    >
      <span className={active ? "text-violet-400" : "text-white/30"}>{item.icon}</span>
      {item.label}
    </Link>
  );
}

// ── Component ───────────────────────────────────────────────────────────────────
export default function SidebarNav({
  session,
}: {
  session: { name: string | null; email: string };
}) {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(
    settingsNav.some((item) => pathname.startsWith(item.href)),
  );
  const [loggingOut, setLoggingOut] = useState(false);

  function isActive(href: string) {
    if (href === "/socialflow") return pathname === "/socialflow";
    return pathname.startsWith(href);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/socialflow/auths/logouts", { method: "POST" });
    } catch {
      // ignore
    }
    window.location.assign("/socialflow/auth");
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-white/8 bg-[#06060f]">
      <div className="flex flex-col gap-5 p-5 flex-1 overflow-y-auto">

        {/* Logo */}
        <div className="flex items-center gap-2.5 pt-1 pb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-black text-white shadow-md shadow-violet-500/20">
            SC
          </div>
          <span className="text-base font-black tracking-tight text-white">
            Social<span className="sf-shimmer-text">cors</span>
          </span>
        </div>

        {/* User card */}
        <div className="rounded-xl border border-white/8 bg-white/5 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-xs font-black text-white mb-2">
            {(session.name ?? session.email).charAt(0).toUpperCase()}
          </div>
          <p className="truncate text-sm font-semibold text-white leading-tight">
            {session.name ?? session.email}
          </p>
          <p className="truncate text-xs text-white/35 mt-0.5">{session.email}</p>
        </div>

        {/* Main nav */}
        <nav className="flex flex-col gap-0.5">
          {mainNavTop.map((item) => renderMainNavItem(item, isActive(item.href)))}

          {renderMainNavItem(
            { href: "/socialflow/publicar", label: "Publicar", icon: <IcoPublish /> },
            isActive("/socialflow/publicar"),
          )}

          {mainNavBottom.map((item) => renderMainNavItem(item, isActive(item.href)))}
        </nav>

        {/* Separator */}
        <div className="h-px bg-white/6" />

        {/* Settings collapsible */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-white/45 hover:bg-white/5 hover:text-white/80 transition-all border border-transparent"
          >
            <span className="flex items-center gap-3">
              <span className="text-white/30"><IcoCog /></span>
              Configuración
            </span>
            <IcoChevron open={settingsOpen} />
          </button>

          {settingsOpen && (
            <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-white/8 pl-3">
              {settingsNav.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                      active
                        ? "bg-violet-500/15 text-violet-300"
                        : "text-white/40 hover:text-white/70 hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Logout footer */}
      <div className="border-t border-white/6 p-4">
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/35 transition hover:bg-white/5 hover:text-white/60 disabled:opacity-40"
        >
          <IcoLogout />
          {loggingOut ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
      </div>
    </aside>
  );
}
