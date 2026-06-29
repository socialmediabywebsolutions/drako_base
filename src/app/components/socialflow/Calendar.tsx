"use client";

import type { SocialCampaign, SocialPost } from "@/app/components/socialflow/types";

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export function Calendar(props: { posts: SocialPost[]; campaigns: SocialCampaign[] }) {
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const weekStart = startOfWeek(now);
  const days: { label: string; dateIso: string }[] = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + idx);
    const label = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
    return { label, dateIso: d.toISOString().slice(0, 10) };
  });

  const postsByDay = new Map<string, SocialPost[]>();
  for (const post of props.posts) {
    if (!post.scheduledAt) continue;
    const key = post.scheduledAt.slice(0, 10);
    if (!postsByDay.has(key)) postsByDay.set(key, []);
    postsByDay.get(key)!.push(post);
  }

  const campaignName = (id: string | null) =>
    id ? props.campaigns.find((c) => c.id === id)?.name ?? "Sin campaña" : "Sin campaña";

  return (
    <div className="grid gap-2 md:grid-cols-7">
      {days.map((day) => {
        const dayPosts = postsByDay.get(day.dateIso) ?? [];
        const isToday = day.dateIso === todayKey;
        return (
          <div
            key={day.dateIso}
            className={
              "flex min-h-[120px] flex-col rounded-lg border p-2 text-xs " +
              (isToday
                ? "border-violet-500/40 bg-violet-500/8 text-white"
                : "border-white/8 bg-white/4 text-white/80")
            }
          >
            <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-white/40">
              <span className={isToday ? "font-semibold text-violet-300" : ""}>{day.label}</span>
              <span className={"text-[10px] " + (isToday ? "text-violet-300/70" : "text-white/25")}>
                {dayPosts.length}
              </span>
            </div>
            <div className="space-y-1">
              {dayPosts.slice(0, 3).map((post) => (
                <div
                  key={post.id}
                  className={
                    "rounded-md p-1.5 " +
                    (isToday ? "bg-white/10 text-white" : "bg-white/6 text-white/85")
                  }
                  title={post.body}
                >
                  <div className="truncate text-[11px] font-medium">{post.title}</div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-white/35">
                    <span>{campaignName(post.campaignId)}</span>
                    <span className="flex items-center gap-1">
                      <span
                        className={[
                          "h-1.5 w-1.5 rounded-full",
                          ["POSTED", "PUBLISHED"].includes(post.status)
                            ? "bg-emerald-400"
                            : ["FAILED", "REJECTED"].includes(post.status)
                            ? "bg-rose-400"
                            : "bg-sky-400",
                        ].join(" ")}
                      />
                      <span>
                        {["POSTED", "PUBLISHED"].includes(post.status)
                          ? "Publicado"
                          : ["FAILED", "REJECTED"].includes(post.status)
                          ? "Error"
                          : "Programado"}
                      </span>
                    </span>
                  </div>
                </div>
              ))}
              {dayPosts.length > 3 && (
                <div className="text-[10px] text-white/25">+{dayPosts.length - 3} más</div>
              )}
              {dayPosts.length === 0 && (
                <div className="mt-2 text-[10px] text-white/20">
                  {isToday ? "Empieza programando un post" : "Sin posts"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
