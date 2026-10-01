"use client";

import { useEffect, useRef } from "react";

// Red neuronal animada del hero de drako.systems: 52 nodos (azul #3b82f6 / turquesa
// #06b6d4) que derivan y se enlazan con líneas cuando están a menos de 155px.
// Componente cliente aparte para no tocar el SSR de la home. Se pausa con la pestaña
// oculta o fuera de pantalla; con prefers-reduced-motion pinta un único frame estático.

const NODES = 52;
const MAX_D = 155;
const NODE_ALPHA = 0.5;
const LINE_ALPHA = 0.1;
const COLORS = ["59,130,246", "6,182,212"] as const;

type Node = { x: number; y: number; vx: number; vy: number; r: number; c: 0 | 1; ph: number };

export function NetworkCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let w = 0;
    let h = 0;
    let nodes: Node[] = [];
    let raf = 0;
    let visible = true;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const makeNode = (): Node => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.38,
      vy: (Math.random() - 0.5) * 0.38,
      r: Math.random() * 2.2 + 1.4,
      c: Math.random() < 0.5 ? 0 : 1,
      ph: Math.random() * Math.PI * 2,
    });

    const draw = (advance: boolean) => {
      ctx.clearRect(0, 0, w, h);
      if (advance) {
        for (const n of nodes) {
          n.ph += 0.018;
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > w) n.vx *= -1;
          if (n.y < 0 || n.y > h) n.vy *= -1;
        }
      }

      ctx.lineWidth = 0.75;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < MAX_D) {
            const fade = 1 - dist / MAX_D;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(59,130,246,${LINE_ALPHA * fade * fade})`;
            ctx.stroke();
          }
        }
      }

      for (const n of nodes) {
        const glow = (Math.sin(n.ph) + 1) * 0.5;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + glow * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${COLORS[n.c]},${NODE_ALPHA + glow * 0.2})`;
        ctx.fill();
      }
    };

    const loop = () => {
      draw(true);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (reduced || raf || !visible || document.hidden) return;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    resize();
    nodes = Array.from({ length: NODES }, makeNode);
    draw(false);
    start();

    const onResize = () => {
      resize();
      for (const n of nodes) {
        n.x = Math.min(n.x, w);
        n.y = Math.min(n.y, h);
      }
      if (reduced) draw(false);
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible) start();
            else stop();
          })
        : null;

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    observer?.observe(canvas);

    return () => {
      stop();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
