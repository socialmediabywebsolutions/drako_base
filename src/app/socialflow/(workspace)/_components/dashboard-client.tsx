"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import type { ScheduledPostItem } from "../_lib/dashboard-data";

// El saludo y el calendario dependen de la hora/zona del navegador (el servidor corre en
// UTC), así que se resuelven tras montar. Antes del primer efecto se pinta un estado neutro.

function greetingFor(hour: number): string {
  if (hour >= 6 && hour < 13) return "Buenos días";
  if (hour >= 13 && hour < 21) return "Buenas tardes";
  return "Buenas noches";
}

export function Greeting({ name }: { name: string | null }) {
  const [greeting, setGreeting] = useState<string | null>(null);
  useEffect(() => setGreeting(greetingFor(new Date().getHours())), []);
  const text = greeting ?? "Hola";
  return (
    <h1 className="text-3xl font-black tracking-tight text-gray-900">
      {text}
      {name ? `, ${name}` : ""}
    </h1>
  );
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function Thumb({ post }: { post: ScheduledPostItem }) {
  const [failed, setFailed] = useState(false);
  if (post.thumbnail && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={post.thumbnail} alt="" onError={() => setFailed(true)} className="h-9 w-9 rounded-md border border-gray-200 object-cover" />
    );
  }
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[9px] font-bold uppercase text-[#3b82f6]">
      {post.type.slice(0, 4)}
    </span>
  );
}

export function WeekCalendar({ posts }: { posts: ScheduledPostItem[] }) {
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setToday(d);
  }, []);

  if (!today) {
    return <div className="grid grid-cols-7 gap-2" aria-hidden="true">{Array.from({ length: 7 }, (_, i) => <div key={i} className="h-28 rounded-xl bg-gray-100" />)}</div>;
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    // setDate mantiene la hora local correcta en cambios de horario (DST)
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return { date: d, key: localDayKey(d), items: [] as ScheduledPostItem[], isToday: i === 0 };
  });
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const post of posts) {
    const day = byKey.get(localDayKey(new Date(post.scheduledAt)));
    if (day) day.items.push(post);
  }
  const total = days.reduce((n, d) => n + d.items.length, 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((day) => (
          <div
            key={day.key}
            className={`flex min-h-[7rem] flex-col rounded-xl border p-2.5 ${
              day.items.length > 0 ? "border-[#3b82f6]/35 bg-[#3b82f6]/[0.06]" : "border-gray-200 bg-gray-50"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${day.isToday ? "text-[#3b82f6]" : "text-gray-400"}`}>
                {day.isToday ? "Hoy" : day.date.toLocaleDateString("es-ES", { weekday: "short" })}
              </span>
              <span className="text-xs font-semibold text-gray-600">{day.date.getDate()}</span>
            </div>
            {day.items.length > 0 ? (
              <div className="mt-2 flex flex-1 flex-col justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {day.items.slice(0, 3).map((post) => (
                    <Thumb key={post.id} post={post} />
                  ))}
                </div>
                <p className="text-[11px] font-semibold text-[#3b82f6]">
                  {day.items.length} {day.items.length === 1 ? "post" : "posts"}
                </p>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <span className="h-px w-5 bg-gray-300" aria-label="Sin publicaciones" />
              </div>
            )}
          </div>
        ))}
      </div>
      {total === 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-gray-600">
            <CalendarDays className="h-4 w-4 text-[#3b82f6]" aria-hidden="true" />
            No tienes nada programado esta semana.
          </p>
          <Link href="/socialflow/upload" className="text-xs font-bold text-[#3b82f6] transition hover:text-[#06b6d4]">
            Programar contenido →
          </Link>
        </div>
      )}
    </>
  );
}
