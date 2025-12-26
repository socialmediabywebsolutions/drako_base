import type { ReactNode } from "react";

type TooltipProps = {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
};

const sideClasses: Record<Required<TooltipProps>["side"], string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 -translate-y-2",
  bottom: "top-full left-1/2 -translate-x-1/2 translate-y-2",
  left: "right-full top-1/2 -translate-y-1/2 -translate-x-2",
  right: "left-full top-1/2 -translate-y-1/2 translate-x-2",
};

export default function Tooltip({ label, side = "top", children }: TooltipProps) {
  return (
    <span className="group relative inline-flex items-center" aria-label={label} role="tooltip">
      {children}
      <span
        className={[
          "pointer-events-none absolute whitespace-nowrap rounded-full border border-[var(--border)]/60 bg-[var(--panel)]/90 px-3 py-1 text-xs text-[var(--foreground)] opacity-0 shadow-lg transition duration-200",
          "group-hover:opacity-100 group-focus-within:opacity-100",
          sideClasses[side],
        ].join(" ")}
      >
        {label}
      </span>
    </span>
  );
}
