import type { DetailedHTMLProps, HTMLAttributes, PropsWithChildren, ThHTMLAttributes, TdHTMLAttributes } from "react";

export function TableWrap({ children, className }: PropsWithChildren & { className?: string }) {
  return (
    <div className={["overflow-x-auto rounded-2xl border border-[var(--border)]/60 bg-[var(--panel)]/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]", className ?? ""].join(" ").trim()}>
      {children}
    </div>
  );
}

export function Table({ children, className, ...rest }: PropsWithChildren & DetailedHTMLProps<HTMLAttributes<HTMLTableElement>, HTMLTableElement>) {
  return (
    <table
      {...rest}
      className={[
        "modern w-full text-sm text-[var(--foreground)]",
        "[&_thead_th]:text-[10px] [&_thead_th]:uppercase [&_thead_th]:tracking-[0.2em]",
        className ?? "",
      ].join(" ").trim()}
    >
      {children}
    </table>
  );
}

export function THead({ children, className, ...rest }: PropsWithChildren & DetailedHTMLProps<HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>) {
  return (
    <thead
      {...rest}
      className={[
        "bg-[var(--panel)]/80",
        "border-b border-[var(--border)]/60",
        "py-2",
        className ?? "",
      ].join(" ").trim()}
    >
      {children}
    </thead>
  );
}

export function TBody({ children, className, ...rest }: PropsWithChildren & DetailedHTMLProps<HTMLAttributes<HTMLTableSectionElement>, HTMLTableSectionElement>) {
  return <tbody {...rest} className={className}>{children}</tbody>;
}

export function TH({ children, className, ...rest }: PropsWithChildren & DetailedHTMLProps<ThHTMLAttributes<HTMLTableCellElement>, HTMLTableCellElement>) {
  return <th {...rest} className={className}>{children}</th>;
}

export function TD({ children, className, ...rest }: PropsWithChildren & DetailedHTMLProps<TdHTMLAttributes<HTMLTableCellElement>, HTMLTableCellElement>) {
  return <td {...rest} className={className}>{children}</td>;
}
