import React from "react";
import type { InputHTMLAttributes, PropsWithChildren, ReactNode, TextareaHTMLAttributes } from "react";

export function Label({ children }: PropsWithChildren) {
  return <label className="text-sm text-[var(--muted)]">{children}</label>;
}

export function Help({ children }: PropsWithChildren) {
  return <p className="text-xs text-[var(--muted)]">{children}</p>;
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={["input w-full", className ?? ""].join(" ").trim()} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={["input w-full", className ?? ""].join(" ").trim()} />;
}

export function Field({ label, help, trailing, children }: { label?: ReactNode; help?: ReactNode; trailing?: ReactNode } & PropsWithChildren) {
  return (
    <div className="space-y-1">
      {label && <Label>{label}</Label>}
      <div className="flex items-center gap-2">{children}{trailing}</div>
      {help && <Help>{help}</Help>}
    </div>
  );
}
