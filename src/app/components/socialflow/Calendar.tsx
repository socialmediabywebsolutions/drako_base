"use client";

import type { SocialCampaign, SocialPost } from "@/app/(dashboard)/socialflow/page";

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // lunes como inicio
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
              (isToday ? "border-gray-900 bg-gray-900 text-gray-50" : "border-gray-100 bg-gray-50 text-gray-900")
            }
          >
            <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-gray-600">
              <span className={isToday ? "font-semibold" : ""}>{day.label}</span>
              <span className={"text-[10px] " + (isToday ? "text-gray-200" : "text-gray-400")}>{dayPosts.length}</span>
            </div>
            <div className="space-y-1">
              {dayPosts.slice(0, 3).map((post) => (
                <div
                  key={post.id}
                  className={
                    "rounded-md p-1.5 shadow-sm " +
                    (isToday ? "bg-gray-800 text-gray-50" : "bg-white text-gray-900")
                  }
                  title={post.body}
                >
                  <div className="truncate text-[11px] font-medium">{post.title}</div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-gray-500">
                    <span>{campaignName(post.campaignId)}</span>
                    <span
                      className={
                        post.status === "SCHEDULED"
                          ? "rounded-full bg-yellow-100 px-1.5 py-0.5 text-[9px] font-medium text-yellow-700"
                          : "rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-medium text-green-700"
                      }
                    >
                      {post.status}
                    </span>
                  </div>
                </div>
              ))}
              {dayPosts.length > 3 && (
                <div className="text-[10px] text-gray-400">
                  +{dayPosts.length - 3} más
                </div>
              )}
              {dayPosts.length === 0 && (
                <div className="mt-2 text-[10px] text-gray-400">
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
