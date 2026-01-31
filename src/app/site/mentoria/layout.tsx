import React from "react";

export default function MentoriaLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-brand/30">
            {/* Optional: Add a specific Navbar here if needed */}
            <main>{children}</main>
        </div>
    );
}
