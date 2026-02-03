import { clsx } from "clsx";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "brand";
type ButtonSize = "xs" | "sm" | "md" | "lg";

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export default function Button({ className, children, variant = "primary", size = "md", loading = false, disabled, ...props }: ButtonProps) {
  const base = "relative inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--brand)] disabled:opacity-60 disabled:cursor-not-allowed";

  const variants: Record<ButtonVariant, string> = {
    primary: "text-white bg-sky-500 shadow-lg shadow-sky-500/30 hover:-translate-y-0.5 hover:bg-sky-600 hover:shadow-sky-600/40",
    secondary: "text-sky-700 bg-sky-100 hover:bg-sky-200 border-2 border-sky-300",
    outline: "text-slate-700 border-2 border-slate-300 bg-transparent hover:bg-slate-50",
    ghost: "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
    brand: "text-white bg-sky-500 border-2 border-sky-400 hover:bg-sky-600",
  };

  const sizes: Record<ButtonSize, string> = {
    xs: "text-xs px-2 py-1 rounded-full",
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
