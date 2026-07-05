"use client";

export const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20";
export const sectionCls = "space-y-3 rounded-xl border border-white/8 bg-white/4 p-5";

export function Field(props: { label: string; value: any; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-white/45">{props.label}</span>
      <input
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-violet-500/50 focus:outline-none"
        placeholder={props.placeholder}
        value={props.value ?? ""}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

export function SelectField(props: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-white/45">{props.label}</span>
      <select
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-violet-500/50 focus:outline-none"
        value={props.value ?? ""}
        onChange={(e) => props.onChange(e.target.value)}
      >
        <option className="bg-[#0b0b16]" value="">Sin especificar</option>
        {props.options.map((opt) => (
          <option className="bg-[#0b0b16]" key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}

export function MiniList(props: { title: string; items: string[] | undefined }) {
  const items = props.items ?? [];
  if (!items.length) return null;
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold text-white/55">{props.title}</h4>
      <ul className="list-disc space-y-0.5 pl-4 text-xs text-white/40">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

export function TextareaField(props: { label: string; value: any; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-white/45">{props.label}</span>
      <textarea
        className="min-h-[80px] w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-violet-500/50 focus:outline-none"
        placeholder={props.placeholder}
        value={props.value ?? ""}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

export function TagField(props: { label: string; value: string[] | undefined; onChange: (v: string[]) => void; placeholder?: string }) {
  const value = props.value ?? [];
  const joined = value.join(", ");
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-white/45">{props.label}</span>
      <input
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-violet-500/50 focus:outline-none"
        placeholder={props.placeholder}
        value={joined}
        onChange={(e) => props.onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
      />
    </label>
  );
}
