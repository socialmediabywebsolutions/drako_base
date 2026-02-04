"use client";

import { useState } from "react";

interface InfoTooltipProps {
    text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div className="relative inline-block">
            <button
                type="button"
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
                onClick={(e) => {
                    e.preventDefault();
                    setIsVisible(!isVisible);
                }}
                className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-sky-100 text-sky-600 hover:bg-sky-200 transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500"
                aria-label="Más información"
            >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
            </button>

            {isVisible && (
                <div className="absolute left-0 top-full mt-2 w-72 z-50 bg-gradient-to-br from-slate-800 to-slate-900 text-white text-sm rounded-lg p-4 shadow-2xl border border-slate-700 animate-fadeIn">
                    <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        <p className="leading-relaxed text-slate-100">{text}</p>
                    </div>
                    {/* Arrow */}
                    <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-800 transform rotate-45 border-t border-l border-slate-700" />
                </div>
            )}
        </div>
    );
}
