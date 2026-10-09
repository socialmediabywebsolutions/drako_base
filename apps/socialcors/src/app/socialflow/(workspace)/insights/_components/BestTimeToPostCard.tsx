import { Image as ImageIcon, Film, BookOpen, LayoutGrid } from "lucide-react";
import type { BestHourByFormat } from "@/lib/socialflow/ai/agents/BestTimeToPostAgent";

const FORMAT_ROWS: { key: keyof BestHourByFormat; label: string; icon: typeof ImageIcon }[] = [
  { key: "FEED", label: "Posts", icon: ImageIcon },
  { key: "REEL", label: "Reels", icon: Film },
  { key: "STORY", label: "Historias", icon: BookOpen },
  { key: "CAROUSEL", label: "Carruseles", icon: LayoutGrid },
];

function formatHour(hourUtc: number): string {
  return `${String(hourUtc).padStart(2, "0")}:00 UTC`;
}

export default function BestTimeToPostCard({ bestHourByFormat }: { bestHourByFormat: BestHourByFormat }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {FORMAT_ROWS.map(({ key, label, icon: Icon }) => {
        const hour = bestHourByFormat[key];
        return (
          <div
            key={key}
            className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="rounded-lg bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] p-2">
              <Icon size={16} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">{label}</p>
              <p className="mt-0.5 text-lg font-black text-gray-900">
                {hour !== null ? formatHour(hour) : <span className="text-sm font-medium text-gray-400">Acumulando datos...</span>}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
