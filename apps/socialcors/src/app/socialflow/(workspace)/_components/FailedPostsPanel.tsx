"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";

type FailedPost = {
  id: string;
  title: string;
  scheduledAt: string | null;
};

type FailedPostsResponse = { ok: boolean; posts?: FailedPost[] };

function formatScheduledAt(value: string | null): string {
  if (!value) return "Sin fecha programada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha programada";
  return date.toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Posts de Instagram que se quedaron en DRAFT sin imagen (IMAGE_GENERATION_FAILED).
// No pinta nada mientras carga ni si no hay posts fallidos — clientes sin errores no lo ven.
export function FailedPostsPanel() {
  const [posts, setPosts] = useState<FailedPost[]>([]);
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());
  const [failedRetries, setFailedRetries] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/socialflow/posts/failed", { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<FailedPostsResponse>) : null))
      .then((data) => {
        if (!cancelled && data?.ok && data.posts) setPosts(data.posts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function regenerate(postId: string) {
    setRegenerating((prev) => new Set(prev).add(postId));
    setFailedRetries((prev) => {
      const next = new Set(prev);
      next.delete(postId);
      return next;
    });
    try {
      const res = await fetch(`/api/socialflow/posts/${encodeURIComponent(postId)}/generate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !data?.ok) throw new Error("REGENERATE_FAILED");
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      setFailedRetries((prev) => new Set(prev).add(postId));
    } finally {
      setRegenerating((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  }

  if (posts.length === 0) return null;

  return (
    <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
      <header className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
        <h2 className="text-sm font-bold text-red-800">Posts pendientes de imagen</h2>
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{posts.length}</span>
      </header>
      <ul className="mt-4 divide-y divide-gray-100">
        {posts.map((post) => {
          const isLoading = regenerating.has(post.id);
          return (
            <li key={post.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{post.title || "Post sin título"}</p>
                <p className="mt-0.5 text-xs text-gray-500">{formatScheduledAt(post.scheduledAt)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {failedRetries.has(post.id) && (
                  <span className="text-xs font-medium text-red-600">No se pudo regenerar, inténtalo más tarde</span>
                )}
                <button
                  type="button"
                  onClick={() => regenerate(post.id)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b82f6] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#2563eb] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Regenerar imagen
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
