'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { LOGO_HEADER_URL } from '@/app/socialflows/_components/landing-config';

export default function PlanesPage() {
  const [billingCycle, setBillingCycle] = useState<'empresas' | 'influencers'>('empresas');

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col">
      {/* Barra de navegación superior unificada */}
      <header className="w-full bg-[#07090e]/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 px-6 py-4">
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

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <Link href="/" className="hover:text-white transition-colors">
              Inicio
            </Link>
            <Link href="/socialflow/como-funciona" className="hover:text-white transition-colors">
              Cómo funciona
            </Link>
            <Link href="/socialflow/planes" className="text-indigo-400 font-semibold">
              Planes
            </Link>
            <Link href="/socialflow/planes" className="hover:text-white transition-colors">
              Iniciar sesión
            </Link>
          </nav>

          <div>
            <Link
              href="/socialflow/planes"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg transition-all"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </header>

      {/* Contenido principal de Planes */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full space-y-12">
        <div className="text-center space-y-4">
          <span className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">
            AUTOMATIZACIÓN AUDIOVISUAL CON IA
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Elige el plan ideal para tu proyecto
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto">
            15 días gratis en todos los planes · Sin tarjeta de crédito · Modifica la duración y los vídeos por IA según tus necesidades.
          </p>

          {/* Selector de tipo */}
          <div className="flex justify-center pt-4">
            <div className="bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 flex gap-2">
              <button
                onClick={() => setBillingCycle('empresas')}
                className={`px-6 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                  billingCycle === 'empresas'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Planes para Empresas
              </button>
              <button
                onClick={() => setBillingCycle('influencers')}
                className={`px-6 py-2.5 text-xs font-semibold rounded-xl transition-all ${
                  billingCycle === 'influencers'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'text-slate-400 hover:text-white'
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
          <div className="bg-[#0d1322] border border-slate-800/80 rounded-3xl p-8 flex flex-col justify-between hover:border-indigo-500/50 transition-all">
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white">Starter</h3>
              <p className="text-xs text-slate-400">Para negocios que quieren presencia constante sin agencias.</p>
              <div className="text-3xl font-extrabold text-white">169€ <span className="text-xs font-normal text-slate-400">/mes</span></div>
              <ul className="space-y-2 text-xs text-slate-300 pt-4 border-t border-slate-800">
                <li>✓ Vídeo IA: 6 vídeos IA/mes (hasta 15s)</li>
                <li>✓ 6 piezas/semana en Instagram</li>
              </ul>
            </div>
            <div className="pt-8">
              <Link
                href="/socialflow/planes"
                className="w-full block text-center py-3 bg-slate-800 hover:bg-indigo-600 text-white text-xs font-semibold rounded-xl transition-all"
              >
                Elegir Starter
              </Link>
            </div>
          </div>

          {/* Básico (Popular) */}
          <div className="bg-[#0d1322] border-2 border-indigo-600 rounded-3xl p-8 flex flex-col justify-between relative shadow-2xl shadow-indigo-950/50">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full">
              Más Popular
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white">Básico</h3>
              <p className="text-xs text-slate-400">Para empresas que necesitan autoridad y Reels trabajados.</p>
              <div className="text-3xl font-extrabold text-white">299€ <span className="text-xs font-normal text-slate-400">/mes</span></div>
              <ul className="space-y-2 text-xs text-slate-300 pt-4 border-t border-slate-800">
                <li>✓ Vídeo IA: 12 vídeos IA/mes (hasta 30s)</li>
                <li>✓ 12 piezas/semana en Instagram</li>
                <li>✓ Máx. 2 publicaciones al día</li>
              </ul>
            </div>
            <div className="pt-8">
              <Link
                href="/socialflow/planes"
                className="w-full block text-center py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all"
              >
                Elegir Básico
              </Link>
            </div>
          </div>

          {/* Pro */}
          <div className="bg-[#0d1322] border border-slate-800/80 rounded-3xl p-8 flex flex-col justify-between hover:border-indigo-500/50 transition-all">
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white">Pro</h3>
              <p className="text-xs text-slate-400">Sustituto completo de agencia de marketing audiovisual.</p>
              <div className="text-3xl font-extrabold text-white">449€ <span className="text-xs font-normal text-slate-400">/mes</span></div>
              <ul className="space-y-2 text-xs text-slate-300 pt-4 border-t border-slate-800">
                <li>✓ Vídeo IA: 20 vídeos IA/mes (hasta 60s)</li>
                <li>✓ Todo lo de Básico</li>
                <li>✓ 14 piezas/semana en Instagram</li>
              </ul>
            </div>
            <div className="pt-8">
              <Link
                href="/socialflow/planes"
                className="w-full block text-center py-3 bg-slate-800 hover:bg-indigo-600 text-white text-xs font-semibold rounded-xl transition-all"
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
