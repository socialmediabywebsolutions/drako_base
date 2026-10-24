import { notFound } from "next/navigation";
import { MentoriaRepository } from "@/lib/mentoria/repository";

type PageProps = {
  params: Promise<{ shareCode: string }>;
};

export default async function MentoriaSharedProgressPage(props: PageProps) {
  const { shareCode } = await props.params;
  const repository = new MentoriaRepository();
  const share = await repository.getProgressShareByCodeGlobal(shareCode);

  if (!share) {
    notFound();
  }

  const payload = share.payload;
  const completedTasks = payload.dailyPlan?.tasks.filter((task) => task.completed) ?? [];

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[32px] bg-white p-8 shadow-[0_24px_90px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-sky-700">Mentoria Progress Share</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight">{payload.studentName}</h1>
          <p className="mt-2 text-sm text-slate-600">{`${payload.schoolYear} · ${payload.summaryMessage}`}</p>
          <div className="mt-6 inline-flex rounded-full bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-900">{payload.headlineMetric}</div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[32px] bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-bold">Progreso por materia</h2>
            <div className="mt-5 space-y-4">
              {payload.progress.map((item) => (
                <div key={item.subject} className="rounded-3xl border border-slate-200 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-semibold">{item.subject}</div>
                    <div className="text-sm text-slate-500">{`${item.masteryScore}% dominio`}</div>
                  </div>
                  <div className="mt-3 text-sm text-slate-600">
                    {`${item.confidenceScore}% confianza · ${item.sessionsCompleted} sesiones · ${item.exercisesCompleted} ejercicios`}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[32px] bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold">Plan del día</h2>
              {payload.dailyPlan ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-3xl bg-slate-50 p-5 text-sm text-slate-700">
                    {`${payload.dailyPlan.recommendedDuration} min · ${Math.round(payload.dailyPlan.completionRate * 100)}% completado`}
                  </div>
                  <div className="space-y-3">
                    {payload.dailyPlan.tasks.map((task) => (
                      <div key={`${task.subject}-${task.type}-${task.difficulty}`} className={`rounded-2xl px-4 py-3 text-sm ${task.completed ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-700"}`}>
                        {`${task.subject} · ${task.type} · D${task.difficulty}${task.completed ? " · completada" : ""}`}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">No hay plan diario publicado.</div>
              )}
            </div>

            <div className="rounded-[32px] bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold">Logros y recomendaciones</h2>
              <div className="mt-5 space-y-3">
                {payload.achievements.map((achievement) => (
                  <div key={achievement} className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {achievement}
                  </div>
                ))}
                {completedTasks.length > 0 ? (
                  <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{`${completedTasks.length} tareas del dia ya estan cerradas.`}</div>
                ) : null}
                {payload.recommendations.map((recommendation) => (
                  <div key={recommendation} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {recommendation}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
