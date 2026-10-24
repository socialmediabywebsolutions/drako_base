'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { LOGO_HEADER_URL } from '@/app/socialflows/_components/landing-config';

export default function PlanesPage() {
  const [billingCycle, setBillingCycle] = useState<'empresas' | 'influencers'>('empresas');

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Barra de navegación superior unificada */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <img
              src={LOGO_HEADER_URL}
              alt="SocialCors"
              width={1536}
              height={1024}
              className="h-10 w-auto object-contain"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Inicio
            </Link>
            <Link href="/socialflow/como-funciona" className="hover:text-slate-900 transition-colors">
              Cómo funciona
            </Link>
            <Link href="/socialflow/planes" className="text-[#3b82f6] font-semibold">
              Planes
            </Link>
            <Link href="/socialflow/auth" className="hover:text-slate-900 transition-colors">
              Iniciar sesión
            </Link>
          </nav>

          <div>
            <Link
              href="/socialflow/auth"
              className="px-4 py-2 bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] hover:brightness-110 text-white text-sm font-semibold rounded-xl shadow-lg transition-all"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </header>

      {/* Contenido principal de Planes */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full space-y-12">
        <div className="text-center space-y-4">
          <span className="text-xs font-semibold tracking-widest text-[#3b82f6] uppercase">
            AUTOMATIZACIÓN AUDIOVISUAL CON IA
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
            Elige el plan ideal para tu proyecto
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl mx-auto">
            15 días gratis en todos los planes · Sin tarjeta de crédito · Modifica la duración y los vídeos por IA según tus necesidades.
          </p>

          {/* Selector de tipo */}
          <div className="flex justify-center pt-4">
            <div className="bg-slate-100 p-1.5 rounded-2xl border border-slate-200 flex gap-2">
              <button
                onClick={() => setBillingCycle('empresas')}
                className={`px-6 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                  billingCycle === 'empresas'
                    ? 'bg-[#3b82f6] text-white shadow-lg'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Planes para Empresas
              </button>
              <button
                onClick={() => setBillingCycle('influencers')}
                className={`px-6 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                  billingCycle === 'influencers'
                    ? 'bg-[#3b82f6] text-white shadow-lg'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Planes para Influencers / Creadores
              </button>
            </div>
          </div>
        </div>

        {/* Tarjetas de Precios */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch pb-16">
          {/* Starter */}
          <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col justify-between hover:border-[#3b82f6]/40 hover:shadow-md transition-all shadow-sm">
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-900">Starter</h3>
              <p className="text-xs text-slate-500">Para negocios que quieren presencia constante sin agencias.</p>
              <div className="text-3xl font-extrabold text-slate-900">169€ <span className="text-xs font-normal text-slate-500">/mes</span></div>
              <ul className="space-y-2 text-xs text-slate-600 pt-4 border-t border-slate-100">
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Vídeo IA: 6 vídeos IA/mes (hasta 15s)</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> 6 piezas/semana en Instagram</li>
              </ul>
            </div>
            <div className="pt-8">
              <Link
                href="/socialflow/auth?plan=empresa-starter"
                className="w-full block text-center py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-all"
              >
                Elegir Starter
              </Link>
            </div>
          </div>

          {/* Básico (Popular) */}
          <div className="bg-[#3b82f6]/5 border-2 border-[#3b82f6]/40 rounded-3xl p-8 flex flex-col justify-between relative shadow-2xl shadow-[#3b82f6]/10 scale-105 ring-1 ring-[#3b82f6]/20">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
              Más Popular
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-900">Básico</h3>
              <p className="text-xs text-slate-500">Para empresas que necesitan autoridad y Reels trabajados.</p>
              <div className="text-3xl font-extrabold text-slate-900">299€ <span className="text-xs font-normal text-slate-500">/mes</span></div>
              <ul className="space-y-2 text-xs text-slate-600 pt-4 border-t border-[#3b82f6]/10">
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Vídeo IA: 12 vídeos IA/mes (hasta 30s)</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> 12 piezas/semana en Instagram</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Máx. 2 publicaciones al día</li>
              </ul>
            </div>
            <div className="pt-8">
              <Link
                href="/socialflow/auth?plan=empresa-basico"
                className="w-full block text-center py-3 bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] hover:brightness-110 text-white text-xs font-semibold rounded-xl shadow-lg shadow-[#3b82f6]/20 transition-all"
              >
                Elegir Básico
              </Link>
            </div>
          </div>

          {/* Pro */}
          <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col justify-between hover:border-[#3b82f6]/40 hover:shadow-md transition-all shadow-sm">
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-slate-900">Pro</h3>
              <p className="text-xs text-slate-500">Sustituto completo de agencia de marketing audiovisual.</p>
              <div className="text-3xl font-extrabold text-slate-900">449€ <span className="text-xs font-normal text-slate-500">/mes</span></div>
              <ul className="space-y-2 text-xs text-slate-600 pt-4 border-t border-slate-100">
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Vídeo IA: 20 vídeos IA/mes (hasta 60s)</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> Todo lo de Básico</li>
                <li className="flex items-center gap-2"><span className="text-emerald-500 font-bold">✓</span> 14 piezas/semana en Instagram</li>
              </ul>
            </div>
            <div className="pt-8">
              <Link
                href="/socialflow/auth?plan=empresa-pro"
                className="w-full block text-center py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition-all"
              >
                Elegir Pro
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
