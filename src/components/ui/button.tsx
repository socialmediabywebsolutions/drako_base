import { clsx } from "clsx";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export default function Button({ className, children, variant = "primary", size = "md", loading = false, disabled, ...props }: ButtonProps) {
  const base = "relative inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--brand)] disabled:opacity-60 disabled:cursor-not-allowed";

  const variants: Record<ButtonVariant, string> = {
    primary: "text-white bg-[var(--brand)] shadow-[0_12px_30px_rgba(76,201,240,0.45)] hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(76,201,240,0.35)]",
    secondary: "text-[var(--brand-strong)] bg-[var(--brand-quiet)] hover:bg-[var(--brand-quiet)]/80",
    outline: "text-[var(--foreground)] border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-transparent hover:bg-[var(--panel)]/70",
    ghost: "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--panel)]/50",
  };

  const sizes: Record<ButtonSize, string> = {
    sm: "text-xs px-3 py-1.5 rounded-full",
    md: "text-sm px-4 py-2 rounded-xl",
    lg: "text-base px-5 py-3 rounded-2xl",
  };

  const content = (
    <span className="inline-flex items-center gap-2">
      {loading && <span className="h-2 w-2 rounded-full bg-current animate-pulse" />}
      {children}
    </span>
  );

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(base, variants[variant], sizes[size], className)}
    >
      {content}
    </button>
  );
}
