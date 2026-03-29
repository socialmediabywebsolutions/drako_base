"use client";

import type { MotivationState } from "@/lib/mentoria/motivation-engine";
import { getMicrocopy, getFocusUiCopy } from "@/lib/mentoria/microcopy";
import type { FocusSession, StudentProfile } from "@/lib/mentoria/types";

export function MentoriaFocusMode({
  student,
  motivation,
  focusTimer,
  focusSession,
  onTimerSelect,
  onStart,
  onComplete,
}: {
  student: StudentProfile;
  motivation: MotivationState | null;
  focusTimer: number;
  focusSession: FocusSession | null;
  onTimerSelect: (value: number) => void;
  onStart: () => void;
  onComplete: () => void;
}) {
  const stage = student.learningStage;
  const ui = getFocusUiCopy(stage);
  const message = getMicrocopy(stage, "focus_message");
  const motivationMessage =
    motivation?.motivationProfile === "fragile"
      ? ui.encouragementFragile
      : motivation?.motivationProfile === "high_performer"
        ? ui.encouragementHighPerformer
        : ui.encouragementStable;

  return (
    <section className="rounded-[28px] bg-white p-6 shadow-sm">
      <h2 className="text-xl font-bold">{ui.title}</h2>
      <div className="mt-4 rounded-3xl bg-indigo-50 p-5">
        <div className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-700">{ui.timerLabel}</div>
        <div className="mt-2 text-sm text-slate-600">{message}</div>
        <div className="mt-2 text-sm font-medium text-indigo-700">{motivationMessage}</div>
        <div className="mt-3 text-5xl font-black">{`${focusTimer} ${ui.minutesSuffix}`}</div>
        {focusSession ? <div className="mt-2 text-sm font-semibold text-indigo-700">{ui.statusLabels[focusSession.status]}</div> : null}
        {motivation ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/70 px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-[0.16em] text-indigo-600">{ui.streakLabel}</div>
              <div className="mt-1 font-bold text-slate-900">{motivation.streak}</div>
            </div>
            <div className="rounded-2xl bg-white/70 px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-[0.16em] text-indigo-600">{ui.effortLabel}</div>
              <div className="mt-1 font-bold text-slate-900">{`${Math.round(motivation.effortScore * 100)}%`}</div>
            </div>
            <div className="rounded-2xl bg-white/70 px-4 py-3 text-sm">
              <div className="text-xs uppercase tracking-[0.16em] text-indigo-600">{ui.levelLabel}</div>
              <div className="mt-1 font-bold text-slate-900">{motivation.level}</div>
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex gap-2">
          {[20, 25, 35].map((value) => (
            <button key={value} onClick={() => onTimerSelect(value)} className="rounded-full border border-indigo-200 px-3 py-2 text-sm">
              {value}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onStart} className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">{ui.startAction}</button>
          <button onClick={onComplete} className="rounded-full border border-indigo-300 px-4 py-2 text-sm font-semibold">{ui.completeAction}</button>
        </div>
      </div>
    </section>
  );
}
