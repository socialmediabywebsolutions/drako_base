import type { SocialInsightsTopPost } from "@/lib/social-core/types";

const CONTENT_TYPE_LABEL: Record<string, string> = {
  FEED: "Post",
  REEL: "Reel",
  STORY: "Historia",
  CAROUSEL: "Carrusel",
  SHORT: "Short",
};

function isMediaUrl(hint: string | null | undefined): hint is string {
  return !!hint && (hint.startsWith("http://") || hint.startsWith("https://"));
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export default function TopPostsList({ posts }: { posts: SocialInsightsTopPost[] }) {
  if (posts.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-sm text-gray-400">
        Aún no hay publicaciones con métricas este mes.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {posts.map((post, index) => (
        <div key={post.id} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-gray-300 hover:bg-gray-50">
          <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-gray-100">
            {isMediaUrl(post.imageHint) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.imageHint} alt={post.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300">🖼️</div>
            )}
            <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white/80">
              #{index + 1}
            </span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#3b82f6]">
            {CONTENT_TYPE_LABEL[post.contentType] ?? post.contentType}
          </p>
          <p className="mt-1 text-xs leading-5 text-gray-600">{truncate(post.body || post.title, 90)}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400">
            <span>❤️ {post.likes}</span>
            <span>💬 {post.comments}</span>
            <span>🔖 {post.saved}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
