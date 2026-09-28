"use client";

import React from "react";

export default function DrakoLanding() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .drako-root {
          font-family: 'Inter', system-ui, sans-serif;
          color: #0f172a;
          background: #ffffff;
          line-height: 1.6;
          -webkit-font-smoothing: antialiased;
        }

        /* ── ANIMATIONS ───────────────────────────────── */
        @keyframes drako-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes drako-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes drako-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes drako-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .drako-pulse-dot {
          display: inline-block;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #06b6d4;
          animation: drako-pulse 2s ease-in-out infinite;
        }
        .drako-blink { animation: drako-blink 1.2s ease-in-out infinite; }

        /* ── GRADIENT TEXT ───────────────────────────── */
        .drako-grad-text {
          background: linear-gradient(135deg, #0891b2, #06b6d4);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* ── NAV ─────────────────────────────────────── */
        .drako-nav {
          position: sticky; top: 0; z-index: 100;
          background: #ffffff;
          border-bottom: 1px solid #e0f2fe;
          padding: 0 24px;
          height: 64px;
          display: flex; align-items: center; justify-content: space-between;
          backdrop-filter: blur(8px);
        }
        .drako-nav-logo {
          display: flex; align-items: center; gap: 10px;
          font-family: 'Space Mono', monospace;
          font-size: 20px; font-weight: 700;
          color: #0891b2;
          text-decoration: none;
          letter-spacing: 2px;
        }
        .drako-logo-hex {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, #0891b2, #06b6d4);
          clip-path: polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%);
          display: flex; align-items: center; justify-content: center;
        }
        .drako-nav-links {
          display: flex; align-items: center; gap: 28px;
          list-style: none;
        }
        .drako-nav-links a {
          font-size: 14px; font-weight: 500;
          color: #475569; text-decoration: none;
          transition: color 0.2s;
        }
        .drako-nav-links a:hover { color: #0891b2; }
        .drako-nav-actions {
          display: flex; align-items: center; gap: 16px;
        }
        .drako-nav-enter {
          font-size: 14px; font-weight: 500;
          color: #0891b2; text-decoration: none;
        }
        .drako-btn-primary {
          display: inline-flex; align-items: center; gap-: 6px;
          padding: 10px 20px;
          background: linear-gradient(135deg, #0891b2, #06b6d4);
          color: #ffffff; font-weight: 600; font-size: 14px;
          border: none; border-radius: 8px; cursor: pointer;
          text-decoration: none;
          transition: opacity 0.2s, transform 0.2s;
          white-space: nowrap;
        }
        .drako-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .drako-btn-outline {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 10px 20px;
          background: transparent;
          color: #0891b2; font-weight: 600; font-size: 14px;
          border: 2px solid #0891b2; border-radius: 8px; cursor: pointer;
          text-decoration: none;
          transition: background 0.2s, color 0.2s;
        }
        .drako-btn-outline:hover { background: #0891b2; color: #fff; }

        /* ── HERO ───────────────────────────────────── */
        .drako-hero {
          position: relative;
          background: #ffffff;
          overflow: hidden;
          padding: 100px 24px 80px;
          text-align: center;
        }
        .drako-hero-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(8,145,178,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(8,145,178,0.05) 1px, transparent 1px);
          background-size: 56px 56px;
          pointer-events: none;
        }
        .drako-hero-glow {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%);
          pointer-events: none;
        }
        .drako-hero-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(8,145,178,0.12);
          pointer-events: none;
        }
        .drako-hero-content {
          position: relative; z-index: 2;
          max-width: 800px; margin: 0 auto;
        }
        .drako-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 16px;
          background: rgba(8,145,178,0.06);
          border: 1px solid rgba(8,145,178,0.2);
          border-radius: 999px;
          font-size: 12px; font-weight: 600; letter-spacing: 0.08em;
          color: #0891b2; text-transform: uppercase;
          margin-bottom: 28px;
        }
        .drako-h1 {
          font-size: clamp(38px, 6vw, 68px);
          font-weight: 900; line-height: 1.1;
          letter-spacing: -0.03em;
          color: #0f172a; margin-bottom: 24px;
        }
        .drako-hero-sub {
          font-size: clamp(16px, 2vw, 20px);
          color: #475569; max-width: 560px;
          margin: 0 auto 40px; line-height: 1.7;
        }
        .drako-hero-btns {
          display: flex; flex-wrap: wrap;
          align-items: center; justify-content: center;
          gap: 16px; margin-bottom: 60px;
        }
        .drako-btn-hero {
          padding: 14px 28px; font-size: 16px; border-radius: 10px;
        }
        .drako-stats-bar {
          display: grid; grid-template-columns: repeat(4, 1fr);
          background: #ffffff;
          border: 1px solid #e0f2fe;
          border-top: 3px solid #06b6d4;
          border-radius: 16px;
          box-shadow: 0 4px 24px rgba(8,145,178,0.08);
          padding: 24px;
          max-width: 700px; margin: 0 auto;
          text-align: center; gap: 0;
        }
        .drako-stat {
          padding: 8px 16px;
          border-right: 1px solid #e0f2fe;
        }
        .drako-stat:last-child { border-right: none; }
        .drako-stat-val {
          font-size: 28px; font-weight: 800;
          font-family: 'Space Mono', monospace;
          color: #0891b2; display: block;
        }
        .drako-stat-lbl {
          font-size: 11px; font-weight: 600;
          color: #64748b; letter-spacing: 0.06em;
          text-transform: uppercase; display: block;
          margin-top: 4px;
        }

        /* ── LOGOS BAR ──────────────────────────────── */
        .drako-logos {
          background: #f0f9ff;
          border-top: 1px solid #bae6fd;
          border-bottom: 1px solid #bae6fd;
          padding: 32px 24px;
        }
        .drako-logos-lbl {
          text-align: center; font-size: 11px;
          font-weight: 700; letter-spacing: 0.1em;
          color: #94a3b8; text-transform: uppercase;
          margin-bottom: 24px;
        }
        .drako-logos-row {
          display: flex; flex-wrap: wrap;
          align-items: center; justify-content: center;
          gap: 32px;
        }
        .drako-logo-pill {
          display: flex; align-items: center; gap: 8px;
          font-family: 'Space Mono', monospace;
          font-size: 14px; font-weight: 700;
          color: #0891b2; opacity: 0.7;
          transition: opacity 0.2s;
        }
        .drako-logo-pill:hover { opacity: 1; }
        .drako-logo-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: linear-gradient(135deg, #0891b2, #06b6d4);
        }

        /* ── FEATURES ───────────────────────────────── */
        .drako-section {
          padding: 80px 24px;
        }
        .drako-section-hd {
          text-align: center; margin-bottom: 56px;
        }
        .drako-section-eyebrow {
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: #0891b2; margin-bottom: 12px; display: block;
        }
        .drako-section-title {
          font-size: clamp(28px, 4vw, 44px);
          font-weight: 800; letter-spacing: -0.02em;
          color: #0f172a; margin-bottom: 16px;
        }
        .drako-section-sub {
          font-size: 17px; color: #64748b;
          max-width: 520px; margin: 0 auto;
        }
        .drako-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px; max-width: 1100px; margin: 0 auto;
        }
        .drako-feat-card {
          background: #ffffff;
          border: 1px solid rgba(8,145,178,0.12);
          border-radius: 18px;
          overflow: hidden;
          transition: transform 0.25s, box-shadow 0.25s;
          cursor: default;
        }
        .drako-feat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 40px rgba(8,145,178,0.12);
        }
        .drako-feat-strip {
          height: 3px;
          background: linear-gradient(90deg, #0891b2, #06b6d4);
        }
        .drako-feat-body { padding: 28px; }
        .drako-feat-icon {
          width: 48px; height: 48px;
          background: rgba(8,145,178,0.08);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
          color: #0891b2;
        }
        .drako-feat-name {
          font-size: 18px; font-weight: 700;
          color: #0f172a; margin-bottom: 8px;
        }
        .drako-feat-desc {
          font-size: 14px; color: #64748b; line-height: 1.65;
        }

        /* ── METRICS BAND ───────────────────────────── */
        .drako-metrics {
          background: linear-gradient(135deg, #0369a1, #0891b2, #06b6d4);
          padding: 60px 24px;
        }
        .drako-metrics-grid {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 0; max-width: 900px; margin: 0 auto; text-align: center;
        }
        .drako-metric {
          padding: 16px;
          border-right: 1px solid rgba(255,255,255,0.2);
        }
        .drako-metric:last-child { border-right: none; }
        .drako-metric-val {
          font-size: 48px; font-weight: 900;
          font-family: 'Space Mono', monospace;
          color: #ffffff; display: block; line-height: 1;
        }
        .drako-metric-lbl {
          font-size: 13px; font-weight: 500;
          color: rgba(255,255,255,0.75); display: block;
          margin-top: 8px;
        }

        /* ── SAAS CARDS ─────────────────────────────── */
        .drako-saas-section {
          background: #f8fafc; padding: 80px 24px;
        }
        .drako-saas-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 24px; max-width: 1100px; margin: 0 auto;
        }
        .drako-saas-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 18px; padding: 28px;
          transition: transform 0.25s, box-shadow 0.25s;
        }
        .drako-saas-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 40px rgba(8,145,178,0.1);
        }
        .drako-saas-av {
          width: 52px; height: 52px;
          border-radius: 14px;
          background: linear-gradient(135deg, #0891b2, #06b6d4);
          color: #fff; font-family: 'Space Mono', monospace;
          font-weight: 700; font-size: 16px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 16px;
        }
        .drako-saas-name {
          font-size: 20px; font-weight: 800;
          color: #0f172a; margin-bottom: 6px;
        }
        .drako-saas-tagline {
          font-size: 13px; color: #0891b2; font-weight: 600;
          margin-bottom: 12px;
        }
        .drako-saas-desc {
          font-size: 13px; color: #64748b;
          line-height: 1.65; margin-bottom: 20px;
        }
        .drako-saas-metrics {
          display: flex; gap: 12px;
          border-top: 1px solid #f1f5f9;
          padding-top: 16px; margin-bottom: 16px;
        }
        .drako-saas-m { text-align: center; flex: 1; }
        .drako-saas-mv {
          font-size: 22px; font-weight: 800;
          color: #0891b2; font-family: 'Space Mono', monospace;
          display: block;
        }
        .drako-saas-ml {
          font-size: 10px; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .drako-pills {
          display: flex; flex-wrap: wrap; gap: 6px;
        }
        .drako-pill {
          font-size: 11px; font-weight: 600;
          padding: 3px 10px; border-radius: 999px;
          background: rgba(8,145,178,0.08);
          color: #0891b2; border: 1px solid rgba(8,145,178,0.15);
        }
        .drako-pill-gray {
          background: #f1f5f9; color: #64748b; border-color: #e2e8f0;
        }

        /* ── HOW IT WORKS ───────────────────────────── */
        .drako-steps-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0; position: relative;
          max-width: 900px; margin: 0 auto;
        }
        .drako-steps-line {
          position: absolute; top: 28px;
          left: calc(12.5% + 24px); right: calc(12.5% + 24px);
          height: 2px;
          background: linear-gradient(90deg, #0891b2, #06b6d4);
          z-index: 0;
        }
        .drako-step {
          text-align: center; padding: 0 12px;
          position: relative; z-index: 1;
        }
        .drako-step-num {
          width: 56px; height: 56px; border-radius: 50%;
          background: linear-gradient(135deg, #0891b2, #06b6d4);
          color: #fff; font-family: 'Space Mono', monospace;
          font-weight: 700; font-size: 15px;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
          box-shadow: 0 4px 16px rgba(8,145,178,0.3);
        }
        .drako-step-title {
          font-size: 15px; font-weight: 700;
          color: #0f172a; margin-bottom: 8px;
        }
        .drako-step-desc {
          font-size: 13px; color: #64748b; line-height: 1.6;
        }

        /* ── TERMINAL ───────────────────────────────── */
        .drako-terminal-section {
          background: #f8fafc; padding: 80px 24px;
        }
        .drako-terminal-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 48px; max-width: 1100px; margin: 0 auto;
          align-items: center;
        }
        .drako-terminal {
          background: #0f172a; border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 24px 64px rgba(0,0,0,0.25);
        }
        .drako-term-bar {
          display: flex; align-items: center; gap: 6px;
          padding: 14px 18px;
          background: #1e293b;
          border-bottom: 1px solid #334155;
        }
        .drako-term-dot {
          width: 12px; height: 12px; border-radius: 50%;
        }
        .drako-term-code {
          padding: 24px;
          font-family: 'Space Mono', monospace;
          font-size: 13px; line-height: 1.9;
        }
        .tc { color: #06b6d4; }
        .tg { color: #4ade80; }
        .tw { color: #94a3b8; }
        .ty { color: #fbbf24; }
        .drako-term-feats { padding: 0; }
        .drako-term-feat {
          display: flex; align-items: flex-start; gap: 14px;
          margin-bottom: 28px;
        }
        .drako-term-feat:last-child { margin-bottom: 0; }
        .drako-term-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: rgba(8,145,178,0.1);
          color: #0891b2;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-top: 2px;
        }
        .drako-term-ft { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
        .drako-term-fd { font-size: 13px; color: #64748b; line-height: 1.6; }

        /* ── AGENTS ─────────────────────────────────── */
        .drako-agents-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px; max-width: 1100px; margin: 0 auto;
        }
        .drako-agent-card {
          background: #ffffff;
          border: 1px solid rgba(8,145,178,0.12);
          border-radius: 16px; padding: 24px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .drako-agent-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(8,145,178,0.1);
        }
        .drako-agent-av {
          width: 48px; height: 48px; border-radius: 12px;
          background: rgba(6,182,212,0.15);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 14px; font-size: 22px;
        }
        .drako-agent-name {
          font-size: 16px; font-weight: 700;
          color: #0f172a; margin-bottom: 6px;
        }
        .drako-agent-role {
          font-size: 12px; font-weight: 600;
          color: #0891b2; letter-spacing: 0.06em;
          text-transform: uppercase; margin-bottom: 10px;
        }
        .drako-agent-desc {
          font-size: 13px; color: #64748b; line-height: 1.65;
        }
        .drako-agent-status {
          display: inline-flex; align-items: center; gap: 5px;
          margin-top: 14px; font-size: 11px; font-weight: 600;
          color: #059669; background: rgba(5,150,105,0.08);
          padding: 4px 10px; border-radius: 999px;
          border: 1px solid rgba(5,150,105,0.15);
        }

        /* ── CTA BAND ───────────────────────────────── */
        .drako-cta {
          background: linear-gradient(135deg, #0c4a6e, #0891b2, #06b6d4);
          padding: 80px 24px; text-align: center;
          position: relative; overflow: hidden;
        }
        .drako-cta-dots {
          position: absolute; inset: 0;
          background-image: radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px);
          background-size: 24px 24px; pointer-events: none;
        }
        .drako-cta-content { position: relative; z-index: 1; }
        .drako-cta h2 {
          font-size: clamp(28px, 4vw, 48px);
          font-weight: 900; color: #ffffff;
          letter-spacing: -0.02em; margin-bottom: 16px;
        }
        .drako-cta p {
          font-size: 18px; color: rgba(255,255,255,0.8);
          margin-bottom: 40px; max-width: 520px; margin-left: auto; margin-right: auto;
        }
        .drako-cta-btns {
          display: flex; flex-wrap: wrap;
          align-items: center; justify-content: center; gap: 16px;
        }
        .drako-btn-white {
          padding: 14px 28px; font-size: 16px;
          background: #ffffff; color: #0891b2;
          font-weight: 700; border-radius: 10px;
          text-decoration: none; transition: opacity 0.2s;
        }
        .drako-btn-white:hover { opacity: 0.9; }
        .drako-btn-outline-white {
          padding: 14px 28px; font-size: 16px;
          background: transparent; color: #ffffff;
          font-weight: 600; border: 2px solid rgba(255,255,255,0.5);
          border-radius: 10px; text-decoration: none;
          transition: border-color 0.2s;
        }
        .drako-btn-outline-white:hover { border-color: #fff; }

        /* ── TECH STRIP ─────────────────────────────── */
        .drako-tech {
          background: #0f172a; padding: 40px 24px; text-align: center;
        }
        .drako-tech-lbl {
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: #475569; margin-bottom: 20px; display: block;
        }
        .drako-tech-pills {
          display: flex; flex-wrap: wrap;
          align-items: center; justify-content: center; gap: 10px;
        }
        .drako-tech-pill {
          font-family: 'Space Mono', monospace;
          font-size: 12px; font-weight: 400;
          padding: 6px 14px; border-radius: 999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94a3b8;
        }

        /* ── FOOTER ─────────────────────────────────── */
        .drako-footer {
          background: #0c1a2e; padding: 64px 24px 32px;
        }
        .drako-footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 48px; max-width: 1100px;
          margin: 0 auto 48px;
        }
        .drako-footer-brand p {
          font-size: 14px; color: #64748b;
          line-height: 1.7; margin-top: 14px;
          max-width: 280px;
        }
        .drako-footer-col h4 {
          font-size: 12px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: #475569; margin-bottom: 16px;
        }
        .drako-footer-col ul { list-style: none; }
        .drako-footer-col ul li { margin-bottom: 10px; }
        .drako-footer-col ul li a {
          font-size: 14px; color: #64748b;
          text-decoration: none; transition: color 0.2s;
        }
        .drako-footer-col ul li a:hover { color: #06b6d4; }
        .drako-footer-bottom {
          display: flex; align-items: center; justify-content: space-between;
          border-top: 1px solid #1e293b; padding-top: 28px;
          max-width: 1100px; margin: 0 auto;
          flex-wrap: wrap; gap: 12px;
        }
        .drako-footer-copy {
          font-size: 13px; color: #475569;
        }
        .drako-footer-links {
          display: flex; gap: 20px;
        }
        .drako-footer-links a {
          font-size: 13px; color: #475569;
          text-decoration: none; transition: color 0.2s;
        }
        .drako-footer-links a:hover { color: #06b6d4; }

        /* ── RESPONSIVE ─────────────────────────────── */
        @media (max-width: 768px) {
          .drako-nav-links { display: none; }
          .drako-stats-bar { grid-template-columns: repeat(2, 1fr); }
          .drako-stat:nth-child(2) { border-right: none; }
          .drako-stat:nth-child(3) { border-top: 1px solid #e0f2fe; }
          .drako-stat:nth-child(4) { border-top: 1px solid #e0f2fe; border-right: none; }
          .drako-metrics-grid { grid-template-columns: repeat(2, 1fr); }
          .drako-metric:nth-child(2) { border-right: none; }
          .drako-metric:nth-child(3) { border-top: 1px solid rgba(255,255,255,0.2); }
          .drako-metric:nth-child(4) { border-top: 1px solid rgba(255,255,255,0.2); border-right: none; }
          .drako-terminal-grid { grid-template-columns: 1fr; }
          .drako-steps-row { grid-template-columns: 1fr 1fr; gap: 32px; }
          .drako-steps-line { display: none; }
          .drako-footer-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
          .drako-footer-brand { grid-column: 1 / -1; }
        }
        @media (max-width: 480px) {
          .drako-steps-row { grid-template-columns: 1fr; }
          .drako-footer-grid { grid-template-columns: 1fr; }
        }
      `}} />

      <div className="drako-root">

        {/* ── NAV ─────────────────────────────────────── */}
        <nav className="drako-nav">
          <a href="/" className="drako-nav-logo">
            <span className="drako-logo-hex">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="white" strokeWidth="2" fill="none"/>
                <circle cx="12" cy="12" r="3" fill="white"/>
              </svg>
            </span>
            DRAKO
          </a>

          <ul className="drako-nav-links">
            {(["Plataforma","SaaS","Agentes IA","Cómo funciona","Precios"] as string[]).map(l => (
              <li key={l}><a href="#">{l}</a></li>
            ))}
            <li><a href="/journal">Revista</a></li>
          </ul>

          <div className="drako-nav-actions">
            <a href="/auth/signin" className="drako-nav-enter">Entrar</a>
            <a href="/contacto" className="drako-btn-primary">Solicitar acceso →</a>
          </div>
        </nav>

        {/* ── HERO ─────────────────────────────────────── */}
        <section className="drako-hero">
          <div className="drako-hero-grid" />
          <div className="drako-hero-glow" />
          <div className="drako-hero-ring" style={{width:600,height:600,top:"50%",left:"50%",transform:"translate(-50%,-50%)"}} />
          <div className="drako-hero-ring" style={{width:900,height:900,top:"50%",left:"50%",transform:"translate(-50%,-50%)"}} />

          <div className="drako-hero-content">
            <div className="drako-badge">
              <span className="drako-pulse-dot" />
              IA · Automatización · Holding Digital
            </div>

            <h1 className="drako-h1">
              La IA que{" "}
              <span className="drako-grad-text">domina</span>
              {" "}tu negocio digital
            </h1>

            <p className="drako-hero-sub">
              Un holding de inteligencia artificial que orquesta agentes, SaaS y campañas
              para que tu negocio crezca solo — mientras tú te concentras en lo que importa.
            </p>

            <div className="drako-hero-btns">
              <a href="/contacto" className="drako-btn-primary drako-btn-hero">
                Solicitar acceso →
              </a>
              <a href="#como-funciona" className="drako-btn-outline drako-btn-hero">
                Ver demo
              </a>
            </div>

            <div className="drako-stats-bar">
              {[
                {val:"26+", lbl:"Agentes IA"},
                {val:"3",   lbl:"SaaS activos"},
                {val:"100%",lbl:"Cloud nativo"},
                {val:"24/7",lbl:"Operación"},
              ].map(s => (
                <div className="drako-stat" key={s.lbl}>
                  <span className="drako-stat-val">{s.val}</span>
                  <span className="drako-stat-lbl">{s.lbl}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── LOGOS BAR ────────────────────────────────── */}
        <div className="drako-logos">
          <p className="drako-logos-lbl">Ecosistema de productos</p>
          <div className="drako-logos-row">
            {["SocialCors","Drako Clinic","Drako Studio","SocialFlow AI","Drako Media"].map(n => (
              <span className="drako-logo-pill" key={n}>
                <span className="drako-logo-dot" />
                {n}
              </span>
            ))}
          </div>
        </div>

        {/* ── FEATURES ─────────────────────────────────── */}
        <section className="drako-section" style={{background:"#fff"}}>
          <div className="drako-section-hd">
            <span className="drako-section-eyebrow">Capacidades</span>
            <h2 className="drako-section-title">Todo lo que necesitas, automatizado</h2>
            <p className="drako-section-sub">
              Una plataforma que trabaja sola: desde la generación de contenido hasta
              la publicación multicanal y el análisis en tiempo real.
            </p>
          </div>

          <div className="drako-cards-grid">
            {[
              {icon:"🤖", name:"Agentes autónomos",        desc:"26+ agentes IA especializados que operan sin intervención humana, ejecutando tareas complejas en paralelo."},
              {icon:"📊", name:"Dashboard unificado",      desc:"Control total desde un panel: campañas, métricas, agentes y clientes — todo en tiempo real."},
              {icon:"🌐", name:"Campañas globales",        desc:"Lanza y gestiona campañas en múltiples idiomas, mercados y plataformas desde un único flujo de trabajo."},
              {icon:"🧠", name:"Base de conocimiento IA", desc:"Cada negocio tiene su propio cerebro IA entrenado con su voz, productos y estrategia de marca."},
              {icon:"🎨", name:"Imágenes con identidad",  desc:"Generación de imágenes y carruseles con identidad visual consistente usando Photon WASM."},
              {icon:"📱", name:"Multi-red automático",     desc:"Instagram, TikTok, LinkedIn, Facebook — publicación sincronizada, con el formato óptimo para cada red."},
            ].map(f => (
              <div className="drako-feat-card" key={f.name}>
                <div className="drako-feat-strip" />
                <div className="drako-feat-body">
                  <div className="drako-feat-icon">{f.icon}</div>
                  <div className="drako-feat-name">{f.name}</div>
                  <div className="drako-feat-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── METRICS BAND ─────────────────────────────── */}
        <div className="drako-metrics">
          <div className="drako-metrics-grid">
            {[
              {val:"10×",  lbl:"Más contenido producido"},
              {val:"∞",    lbl:"Escalabilidad automática"},
              {val:"–80%", lbl:"Tiempo operativo ahorrado"},
              {val:"0 h",  lbl:"Horas manuales requeridas"},
            ].map(m => (
              <div className="drako-metric" key={m.lbl}>
                <span className="drako-metric-val">{m.val}</span>
                <span className="drako-metric-lbl">{m.lbl}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── SAAS CARDS ───────────────────────────────── */}
        <section className="drako-saas-section">
          <div className="drako-section-hd">
            <span className="drako-section-eyebrow">SaaS Portfolio</span>
            <h2 className="drako-section-title">Productos especializados por industria</h2>
            <p className="drako-section-sub">
              Cada SaaS resuelve un problema específico con IA integrada desde el primer día.
            </p>
          </div>

          <div className="drako-saas-grid">
            {[
              {av:"SC", name:"SocialCors",    tag:"Agencias & Marcas",   desc:"Automatización completa de marketing en redes sociales. Crea, publica y analiza sin equipo.",            metrics:[{v:"∞",l:"Cuentas"},{v:"26+",l:"Agentes"}],             pills:["Instagram","TikTok","IA Content","Analytics"]},
              {av:"DC", name:"Drako Clinic",  tag:"Clínicas & Salud",    desc:"CRM inteligente para clínicas. Agentes de captación, seguimiento y fidelización de pacientes.",         metrics:[{v:"24/7",l:"Bots"},{v:"–60%",l:"No-shows"}],            pills:["CRM","WhatsApp","Citas","Reportes"]},
              {av:"DS", name:"Drako Studio",  tag:"Creativos & Diseño",  desc:"Suite creativa con IA para agencias de diseño y producción audiovisual.",                                metrics:[{v:"10×",l:"Output"},{v:"100%",l:"IA"}],                  pills:["Imágenes","Carruseles","Video","Branding"]},
              {av:"🚀", name:"En desarrollo", tag:"Próximamente",         desc:"Nuevas verticales en construcción. Fintech, EdTech y E-commerce ya están en hoja de ruta.",            metrics:[{v:"Q3",l:"2026"},{v:"3",l:"Verticales"}],               pills:["Fintech","EdTech","E-commerce"]},
            ].map(s => (
              <div className="drako-saas-card" key={s.name}>
                <div className="drako-saas-av">{s.av}</div>
                <div className="drako-saas-name">{s.name}</div>
                <div className="drako-saas-tagline">{s.tag}</div>
                <div className="drako-saas-desc">{s.desc}</div>
                <div className="drako-saas-metrics">
                  {s.metrics.map(m => (
                    <div className="drako-saas-m" key={m.l}>
                      <span className="drako-saas-mv">{m.v}</span>
                      <span className="drako-saas-ml">{m.l}</span>
                    </div>
                  ))}
                </div>
                <div className="drako-pills">
                  {s.pills.map(p => (
                    <span className="drako-pill" key={p}>{p}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ─────────────────────────────── */}
        <section className="drako-section" id="como-funciona" style={{background:"#fff"}}>
          <div className="drako-section-hd">
            <span className="drako-section-eyebrow">Proceso</span>
            <h2 className="drako-section-title">Cómo funciona Drako</h2>
            <p className="drako-section-sub">
              De cero a negocio automatizado en cuatro pasos. Sin fricciones técnicas.
            </p>
          </div>

          <div style={{position:"relative", maxWidth:900, margin:"0 auto"}}>
            <div className="drako-steps-line" />
            <div className="drako-steps-row">
              {[
                {n:"01", t:"Onboarding IA",         d:"Conectas tu negocio, marca y objetivos. Los agentes aprenden tu identidad."},
                {n:"02", t:"Configuras agentes",     d:"Elige qué automatizar: contenido, publicación, captación o análisis."},
                {n:"03", t:"La IA ejecuta sola",    d:"Los agentes trabajan 24/7 sin que tengas que intervenir."},
                {n:"04", t:"Tú supervisas y creces",d:"Dashboard en tiempo real. Tú decides la estrategia; la IA la ejecuta."},
              ].map(s => (
                <div className="drako-step" key={s.n}>
                  <div className="drako-step-num">{s.n}</div>
                  <div className="drako-step-title">{s.t}</div>
                  <div className="drako-step-desc">{s.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── TERMINAL ─────────────────────────────────── */}
        <section className="drako-terminal-section">
          <div className="drako-section-hd">
            <span className="drako-section-eyebrow">Tecnología</span>
            <h2 className="drako-section-title">Potencia real bajo el capó</h2>
          </div>

          <div className="drako-terminal-grid">
            <div className="drako-terminal">
              <div className="drako-term-bar">
                <div className="drako-term-dot" style={{background:"#ef4444"}} />
                <div className="drako-term-dot" style={{background:"#f59e0b"}} />
                <div className="drako-term-dot" style={{background:"#22c55e"}} />
                <span style={{marginLeft:8, fontSize:12, color:"#64748b", fontFamily:"Space Mono,monospace"}}>drako-orchestrator</span>
              </div>
              <div className="drako-term-code">
                <div><span className="tw">$</span> <span className="tc">drako</span> <span className="tg">launch</span> <span className="tw">--campaign</span> <span className="ty">social-q3</span></div>
                <div><span className="tc">▸</span> <span className="tw">Iniciando orquestador de campaña...</span></div>
                <div><span className="tc">▸</span> <span className="tg">✓</span> <span className="tw">26 agentes cargados</span></div>
                <div><span className="tc">▸</span> <span className="tg">✓</span> <span className="tw">Base de conocimiento sincronizada</span></div>
                <div><span className="tc">▸</span> <span className="tw">Generando contenido...</span></div>
                <div><span className="tc">  </span> <span className="tw">Instagram: </span><span className="tg">5 posts</span></div>
                <div><span className="tc">  </span> <span className="tw">TikTok:   </span><span className="tg">3 reels</span></div>
                <div><span className="tc">  </span> <span className="tw">LinkedIn: </span><span className="tg">2 artículos</span></div>
                <div><span className="tc">▸</span> <span className="tg">✓</span> <span className="tw">Imágenes generadas (Photon WASM)</span></div>
                <div><span className="tc">▸</span> <span className="tg">✓</span> <span className="tw">Programado para 6am — 9am — 6pm</span></div>
                <div><span className="tc">▸</span> <span className="tg">✓</span> <span className="tw">Campaña activa. Monitoreando...</span></div>
                <div><span className="tc">  </span><span className="drako-blink" style={{color:"#06b6d4"}}>█</span></div>
              </div>
            </div>

            <div className="drako-term-feats">
              {[
                {icon:"⚡", t:"Edge Computing",       d:"Desplegado en Cloudflare Workers. Latencia &lt;50ms desde cualquier punto del planeta."},
                {icon:"🔒", t:"Multi-tenant seguro",  d:"Cada cliente con su propio tenant aislado. D1 Database + R2 Storage por workspace."},
                {icon:"🎨", t:"Photon WASM",          d:"Generación de imágenes y carruseles con identidad visual directamente en el edge."},
                {icon:"🔄", t:"AI Queue Workers",     d:"Cola de tareas asíncronas para que los agentes operen sin límites de tiempo."},
              ].map(f => (
                <div className="drako-term-feat" key={f.t}>
                  <div className="drako-term-icon">{f.icon}</div>
                  <div>
                    <div className="drako-term-ft">{f.t}</div>
                    <div className="drako-term-fd" dangerouslySetInnerHTML={{__html: f.d}} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── AGENTS ───────────────────────────────────── */}
        <section className="drako-section" style={{background:"#fff"}}>
          <div className="drako-section-hd">
            <span className="drako-section-eyebrow">Agentes IA</span>
            <h2 className="drako-section-title">Tu equipo de IA especializado</h2>
            <p className="drako-section-sub">
              Cada agente tiene un rol, una especialización y trabaja en equipo con los demás.
            </p>
          </div>

          <div className="drako-agents-grid">
            {[
              {em:"✍️", name:"Content Writer IA",      role:"Redacción",        desc:"Genera textos, captions y copies adaptados a cada red social y audiencia."},
              {em:"🖼️", name:"Image Generator IA",     role:"Creatividad",      desc:"Crea imágenes y carruseles con tu identidad visual usando Photon WASM."},
              {em:"📈", name:"Analytics Agent",        role:"Análisis",         desc:"Monitoriza métricas, detecta tendencias y sugiere ajustes estratégicos."},
              {em:"📤", name:"Social Publisher",       role:"Distribución",     desc:"Publica en el momento óptimo en todas las redes automáticamente."},
              {em:"👤", name:"Patient Manager IA",     role:"CRM Salud",        desc:"Gestiona citas, recordatorios y seguimiento de pacientes en Drako Clinic."},
              {em:"🎯", name:"Campaign Orchestrator",  role:"Estrategia",       desc:"Coordina todos los agentes para ejecutar campañas multicanal sin fricción."},
            ].map(a => (
              <div className="drako-agent-card" key={a.name}>
                <div className="drako-agent-av">{a.em}</div>
                <div className="drako-agent-name">{a.name}</div>
                <div className="drako-agent-role">{a.role}</div>
                <div className="drako-agent-desc">{a.desc}</div>
                <div className="drako-agent-status">
                  <span className="drako-pulse-dot" style={{width:6,height:6,background:"#059669"}} />
                  Activo 24/7
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA BAND ─────────────────────────────────── */}
        <section className="drako-cta">
          <div className="drako-cta-dots" />
          <div className="drako-cta-content">
            <h2>Deja que la IA lleve tu negocio</h2>
            <p style={{marginBottom:40}}>
              Únete a los negocios que ya automatizan su crecimiento con Drako Systems.
            </p>
            <div className="drako-cta-btns">
              <a href="/contacto" className="drako-btn-white">Solicitar acceso →</a>
              <a href="#como-funciona" className="drako-btn-outline-white">Ver cómo funciona</a>
            </div>
          </div>
        </section>

        {/* ── TECH STRIP ───────────────────────────────── */}
        <div className="drako-tech">
          <span className="drako-tech-lbl">Stack tecnológico</span>
          <div className="drako-tech-pills">
            {["Next.js 15","Cloudflare Workers","D1 Database","R2 Storage","AI Queue Workers","Photon WASM","Tailwind CSS v4","NextAuth v4"].map(t => (
              <span className="drako-tech-pill" key={t}>{t}</span>
            ))}
          </div>
        </div>

        {/* ── FOOTER ───────────────────────────────────── */}
        <footer className="drako-footer">
          <div className="drako-footer-grid">
            <div className="drako-footer-brand">
              <a href="/" className="drako-nav-logo" style={{color:"#06b6d4"}}>
                <span className="drako-logo-hex">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" stroke="white" strokeWidth="2" fill="none"/>
                    <circle cx="12" cy="12" r="3" fill="white"/>
                  </svg>
                </span>
                DRAKO
              </a>
              <p>
                Holding de inteligencia artificial especializada en automatización de negocios digitales.
                Construido sobre Cloudflare Edge para máximo rendimiento global.
              </p>
            </div>

            <div className="drako-footer-col">
              <h4>Plataforma</h4>
              <ul>
                {["Agentes IA","Dashboard","Campañas","Integraciones","API"].map(l => (
                  <li key={l}><a href="#">{l}</a></li>
                ))}
              </ul>
            </div>

            <div className="drako-footer-col">
              <h4>SaaS</h4>
              <ul>
                {["SocialCors","Drako Clinic","Drako Studio","SocialFlow AI"].map(l => (
                  <li key={l}><a href="#">{l}</a></li>
                ))}
              </ul>
            </div>

            <div className="drako-footer-col">
              <h4>Empresa</h4>
              <ul>
                {["Nosotros","Blog","Precios","Contacto","Privacidad"].map(l => (
                  <li key={l}><a href="#">{l}</a></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="drako-footer-bottom">
            <span className="drako-footer-copy">
              © {new Date().getFullYear()} Drako Systems. Todos los derechos reservados.
            </span>
            <div className="drako-footer-links">
              <a href="/privacidad">Privacidad</a>
              <a href="/terminos">Términos</a>
              <a href="/cookies">Cookies</a>
            </div>
          </div>
        </footer>

      </div>
    </>
  );
}
