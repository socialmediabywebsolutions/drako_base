"use client";

import { motion } from "framer-motion";

interface ProjectSidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function ProjectSidebar({ collapsed, onToggle }: ProjectSidebarProps) {
    const navItems = [
        { icon: "📊", label: "Overview", href: "#overview" },
        { icon: "🎨", label: "Blueprint", href: "#blueprint" },
        { icon: "📈", label: "Analytics", href: "#analytics" },
        { icon: "⚙️", label: "Settings", href: "#settings" }
    ];

    return (
        <motion.aside
            initial={false}
            animate={{ width: collapsed ? 64 : 320 }}
            className="h-screen bg-white border-r border-slate-200 flex flex-col relative overflow-hidden transition-all duration-300"
        >
            {/* Toggle Button */}
            <button
                onClick={onToggle}
                className="absolute top-4 -right-3 z-50 w-6 h-6 bg-sky-500 text-white rounded-full shadow-lg hover:bg-sky-600 transition-colors flex items-center justify-center"
            >
                <svg className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            {/* Header */}
            <div className="p-6 border-b border-slate-200">
                {!collapsed ? (
                    <div>
                        <h2 className="text-lg font-black text-slate-900">Mi Proyecto</h2>
                        <p className="text-xs text-slate-500 font-medium mt-1">Drako SaaS Factory</p>
                    </div>
                ) : (
                    <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-sky-600 rounded-xl flex items-center justify-center text-white font-black">
                        D
                    </div>
                )}
            </div>

            {/* Status Card */}
            {!collapsed && (
                <div className="p-4 mx-4 mt-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Operativo</span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">99.9% Uptime • Edge EU-West</p>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {navItems.map((item, idx) => (
                    <a
                        key={idx}
                        href={item.href}
                        className={`
              flex items-center gap-3 px-4 py-3 rounded-xl transition-all
              hover:bg-sky-50 hover:text-sky-600 text-slate-700 font-medium text-sm
              ${collapsed ? 'justify-center' : ''}
            `}
                        title={collapsed ? item.label : undefined}
                    >
                        <span className="text-lg">{item.icon}</span>
                        {!collapsed && <span>{item.label}</span>}
                    </a>
                ))}
            </nav>

            {/* Quick Actions */}
            {!collapsed && (
                <div className="p-4 border-t border-slate-200 space-y-2">
                    <button className="w-full px-4 py-2 bg-sky-500 text-white text-sm font-bold rounded-lg hover:bg-sky-600 transition-colors">
                        Deploy Now
                    </button>
                    <button className="w-full px-4 py-2 border border-slate-200 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors">
                        Export Code
                    </button>
                </div>
            )}
        </motion.aside>
    );
}
