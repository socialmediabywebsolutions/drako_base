"use client";

import { useEffect, useState } from "react";
import { BookOpen, Calendar, ChevronRight, Clock, Plus, Target, Trophy, X, Zap } from "lucide-react";
import { WorkspaceShell } from "@/components/mentoria-app/workspace-shell";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type DeclaredExam = {
  id: string;
  subjectId: string;
  subjectName: string;
  examDate: string;
  examLabel: string | null;
  difficulty: string;
  daysUntil: number;
  sessionsDone: number;
  sessionsPlanned: number;
};

type ExamDaySession = {
  day: number;
  date: string;
  sessionLabel: string;
  focusTopics: string[];
  sessionType: "repaso" | "practica" | "simulacro" | "repaso_final";
  durationMinutes: number;
  tutorInstruction: string;
};

type ExamPlan = {
  totalSessions: number;
  durationDaysTotal: number;
  sessions: ExamDaySession[];
  keyPriorities: string[];
  examTip: string;
};

type SimulationQuestion = {
  question: string;
  expectedAnswer: string;
  hint: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
};

type Simulation = {
  questions: SimulationQuestion[];
  durationSeconds: number;
  focusTopic: string;
  simulacroLabel: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Fácil",
  medium: "Media",
  hard: "Difícil",
};

const SESSION_TYPE_COLORS: Record<string, string> = {
  repaso: "bg-blue-50 text-blue-700 border-blue-100",
  practica: "bg-emerald-50 text-emerald-700 border-emerald-100",
  simulacro: "bg-violet-50 text-violet-700 border-violet-100",
  repaso_final: "bg-amber-50 text-amber-700 border-amber-100",
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  repaso: "Repaso",
  practica: "Práctica",
  simulacro: "Simulacro",
  repaso_final: "Repaso final",
};

function urgencyColor(days: number) {
  if (days <= 1) return "bg-red-500";
  if (days <= 3) return "bg-amber-500";
  if (days <= 7) return "bg-blue-500";
  return "bg-emerald-500";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

// ─── Formulario para declarar examen ─────────────────────────────────────────

function NewExamForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [subjectName, setSubjectName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examLabel, setExamLabel] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectName || !examDate) return;
    setLoading(true);
    try {
      await fetch("/api/mentoria/exam-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: subjectName.toLowerCase().replace(/\s+/g, "_"),
          subjectName,
          examDate,
          examLabel: examLabel || undefined,
          difficulty,
        }),
      });
      onCreated();
    } finally {
      setLoading(false);
    }
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Materia</label>
        <input
          type="text"
          value={subjectName}
          onChange={(e) => setSubjectName(e.target.value)}
          placeholder="Ej: Matemáticas, Historia, Física..."
          required
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Fecha del examen</label>
        <input
          type="date"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          min={minDate}
          required
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">¿Qué tipo de examen es? <span className="font-normal text-slate-400">(opcional)</span></label>
        <input
          type="text"
          value={examLabel}
          onChange={(e) => setExamLabel(e.target.value)}
          placeholder="Ej: Examen parcial, Selectividad, Control tema 3..."
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Dificultad percibida</label>
        <div className="flex gap-2">
          {(["easy", "medium", "hard"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              className={`flex-1 rounded-2xl border py-2.5 text-sm font-semibold transition ${
                difficulty === d
                  ? "border-blue-400 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {DIFFICULTY_LABELS[d]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || !subjectName || !examDate}
          className="flex-1 rounded-2xl bg-blue-500 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? "Guardando..." : "Añadir examen"}
        </button>
      </div>
    </form>
  );
}

// ─── Panel del plan de un examen ─────────────────────────────────────────────

function ExamPlanPanel({ exam, onClose }: { exam: DeclaredExam; onClose: () => void }) {
  const [plan, setPlan] = useState<ExamPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/mentoria/exam-mode?action=plan&exam_id=${exam.id}`)
      .then((r) => r.json())
      .then((data: { plan?: ExamPlan }) => setPlan(data.plan ?? null))
      .finally(() => setLoading(false));
  }, [exam.id]);

  async function markSessionDone() {
    await fetch("/api/mentoria/exam-mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId: exam.id, action: "complete_session" }),
    });
    window.location.reload();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900">{exam.subjectName}</h3>
          {exam.examLabel && <div className="text-sm text-slate-500">{exam.examLabel}</div>}
          <div className="mt-1 text-xs text-slate-400">{formatDate(exam.examDate)}</div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Progreso */}
      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-slate-700">Sesiones completadas</span>
          <span className="font-bold text-slate-900">{exam.sessionsDone}/{exam.sessionsPlanned}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${exam.sessionsPlanned > 0 ? (exam.sessionsDone / exam.sessionsPlanned) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Plan */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-slate-400">
          Generando plan de preparación...
        </div>
      ) : plan ? (
        <>
          {plan.keyPriorities.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Prioridades clave</div>
              <div className="flex flex-wrap gap-1.5">
                {plan.keyPriorities.map((p, i) => (
                  <span key={i} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Plan de sesiones</div>
            <div className="space-y-2">
              {plan.sessions.map((session, i) => (
                <div
                  key={i}
                  className={`rounded-2xl border px-4 py-3 ${SESSION_TYPE_COLORS[session.sessionType]}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm">{session.sessionLabel}</div>
                    <div className="flex items-center gap-1.5 text-xs opacity-75">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {session.durationMinutes} min
                    </div>
                  </div>
                  <div className="mt-1 text-xs opacity-75">{formatDate(session.date)} · {SESSION_TYPE_LABELS[session.sessionType]}</div>
                  {session.focusTopics.length > 0 && (
                    <div className="mt-1.5 text-xs opacity-80">
                      Temas: {session.focusTopics.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {plan.examTip && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span className="font-semibold">Consejo: </span>{plan.examTip}
            </div>
          )}

          <button
            type="button"
            onClick={markSessionDone}
            className="w-full rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            ✓ Marcar sesión de hoy como completada
          </button>
        </>
      ) : (
        <div className="text-center text-sm text-slate-400">No se pudo generar el plan.</div>
      )}
    </div>
  );
}

// ─── Simulacro ────────────────────────────────────────────────────────────────

function SimulationPanel({ exam, onClose }: { exam: DeclaredExam; onClose: () => void }) {
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/mentoria/exam-mode?action=simulation&exam_id=${exam.id}`)
      .then((r) => r.json())
      .then((data: { simulation?: Simulation }) => setSimulation(data.simulation ?? null))
      .finally(() => setLoading(false));
  }, [exam.id]);

  async function finishSimulation() {
    if (!simulation) return;
    await fetch("/api/mentoria/exam-mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        examId: exam.id,
        action: "complete_simulation",
        simulationData: {
          durationSeconds: simulation.durationSeconds,
          questionsCount: simulation.questions.length,
        },
      }),
    });
    setDone(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-slate-400">
        Generando simulacro...
      </div>
    );
  }

  if (!simulation) return <div className="text-center text-sm text-slate-400 py-8">No se pudo generar el simulacro.</div>;

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <Trophy className="h-12 w-12 text-amber-400" aria-hidden="true" />
        <div className="text-lg font-bold text-slate-900">¡Simulacro completado!</div>
        <div className="text-sm text-slate-500">Has repasado {simulation.questions.length} preguntas de {exam.subjectName}.</div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 rounded-2xl bg-blue-500 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-600"
        >
          Volver al modo examen
        </button>
      </div>
    );
  }

  const q = simulation.questions[currentQuestion];
  const isLast = currentQuestion === simulation.questions.length - 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{simulation.simulacroLabel}</div>
          <div className="text-sm text-slate-400 mt-0.5">Pregunta {currentQuestion + 1} de {simulation.questions.length}</div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Barra de progreso */}
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-violet-500 transition-all"
          style={{ width: `${((currentQuestion + 1) / simulation.questions.length) * 100}%` }}
        />
      </div>

      {/* Pregunta */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5">
        <div className="flex items-center gap-2 mb-3">
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            q.difficulty === "easy" ? "bg-emerald-50 text-emerald-700" :
            q.difficulty === "medium" ? "bg-amber-50 text-amber-700" :
            "bg-red-50 text-red-700"
          }`}>
            {DIFFICULTY_LABELS[q.difficulty]}
          </span>
          <span className="text-xs text-slate-400">{q.topic}</span>
        </div>
        <p className="text-sm font-semibold leading-relaxed text-slate-900">{q.question}</p>
      </div>

      {/* Pista */}
      {!showAnswer && (
        <button
          type="button"
          onClick={() => setShowHint(true)}
          className="text-left text-xs text-slate-400 underline"
        >
          {showHint ? `💡 ${q.hint}` : "Ver pista"}
        </button>
      )}

      {/* Respuesta */}
      {showAnswer ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">Respuesta esperada</div>
          <p className="text-sm text-emerald-900">{q.expectedAnswer}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAnswer(true)}
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Ver respuesta
        </button>
      )}

      {/* Siguiente / Finalizar */}
      {showAnswer && (
        <button
          type="button"
          onClick={() => {
            if (isLast) {
              finishSimulation();
            } else {
              setCurrentQuestion((n) => n + 1);
              setShowAnswer(false);
              setShowHint(false);
            }
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-500 py-3 text-sm font-semibold text-white transition hover:bg-violet-600"
        >
          {isLast ? "Terminar simulacro" : "Siguiente pregunta"}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ─── Tarjeta de examen ────────────────────────────────────────────────────────

function ExamCard({
  exam,
  onViewPlan,
  onStartSimulation,
  onMarkDone,
}: {
  exam: DeclaredExam;
  onViewPlan: () => void;
  onStartSimulation: () => void;
  onMarkDone: () => void;
}) {
  const urgency = urgencyColor(exam.daysUntil);
  const progressPct = exam.sessionsPlanned > 0 ? (exam.sessionsDone / exam.sessionsPlanned) * 100 : 0;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      {/* Indicador de urgencia */}
      <div className={`${urgency} h-1`} />

      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-bold text-slate-900">{exam.subjectName}</h3>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {DIFFICULTY_LABELS[exam.difficulty]}
              </span>
            </div>
            {exam.examLabel && (
              <div className="mt-0.5 truncate text-sm text-slate-500">{exam.examLabel}</div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className={`text-xl font-black ${exam.daysUntil <= 3 ? "text-red-500" : "text-slate-900"}`}>
              {exam.daysUntil}
            </div>
            <div className="text-[11px] text-slate-400">días</div>
          </div>
        </div>

        <div className="mt-1 text-xs text-slate-400">{formatDate(exam.examDate)}</div>

        {/* Progreso de sesiones */}
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600">Sesiones preparación</span>
            <span className="text-slate-500">{exam.sessionsDone}/{exam.sessionsPlanned}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Acciones */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onViewPlan}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-blue-50 py-2.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            Plan
          </button>
          <button
            type="button"
            onClick={onStartSimulation}
            disabled={exam.daysUntil > 14}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-violet-50 py-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            Simulacro
          </button>
          <button
            type="button"
            onClick={onMarkDone}
            className="flex items-center justify-center rounded-2xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
            title="Marcar examen como realizado"
          >
            ✓
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

type PanelMode = { type: "plan"; exam: DeclaredExam } | { type: "simulation"; exam: DeclaredExam } | null;

export function MentoriaExamHub() {
  const [exams, setExams] = useState<DeclaredExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [activePanel, setActivePanel] = useState<PanelMode>(null);

  async function loadExams() {
    setLoading(true);
    try {
      const r = await fetch("/api/mentoria/exam-mode?action=list");
      const data = await r.json() as { exams?: DeclaredExam[] };
      setExams(data.exams ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadExams(); }, []);

  async function markDone(examId: string) {
    await fetch("/api/mentoria/exam-mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId, action: "mark_done" }),
    });
    await loadExams();
  }

  return (
    <WorkspaceShell>
      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Cabecera */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900">Modo Examen</h1>
            <p className="mt-0.5 text-sm text-slate-500">Prepara cada examen con un plan y simulacros.</p>
          </div>
          <button
            type="button"
            onClick={() => { setShowNewForm(true); setActivePanel(null); }}
            className="flex items-center gap-2 rounded-2xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Nuevo examen</span>
          </button>
        </div>

        {/* Panel lateral (plan o simulacro) */}
        {activePanel && (
          <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            {activePanel.type === "plan" ? (
              <ExamPlanPanel exam={activePanel.exam} onClose={() => setActivePanel(null)} />
            ) : (
              <SimulationPanel exam={activePanel.exam} onClose={() => setActivePanel(null)} />
            )}
          </div>
        )}

        {/* Formulario nuevo examen */}
        {showNewForm && (
          <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-slate-900">Declarar examen</h2>
            <NewExamForm
              onCreated={() => { setShowNewForm(false); loadExams(); }}
              onCancel={() => setShowNewForm(false)}
            />
          </div>
        )}

        {/* Lista de exámenes */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-400">
            Cargando exámenes...
          </div>
        ) : exams.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-slate-200 py-12 text-center">
            <Target className="h-10 w-10 text-slate-300" aria-hidden="true" />
            <div>
              <div className="font-semibold text-slate-700">Sin exámenes declarados</div>
              <div className="mt-1 text-sm text-slate-400">Añade un examen para que el sistema te prepare un plan personalizado.</div>
            </div>
            <button
              type="button"
              onClick={() => setShowNewForm(true)}
              className="rounded-2xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-600"
            >
              Añadir mi primer examen
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {exams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                onViewPlan={() => setActivePanel({ type: "plan", exam })}
                onStartSimulation={() => setActivePanel({ type: "simulation", exam })}
                onMarkDone={() => markDone(exam.id)}
              />
            ))}
          </div>
        )}

        {/* Footer info */}
        {exams.length > 0 && !showNewForm && !activePanel && (
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            Los simulacros se activan a partir de 14 días antes del examen.
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
