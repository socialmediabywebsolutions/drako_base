"use client";

export const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#3b82f6]/60 focus:outline-none focus:ring-1 focus:ring-[#3b82f6]/20";
export const sectionCls = "space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm";

export function Field(props: { label: string; value: any; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-gray-500">{props.label}</span>
      <input
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#3b82f6]/60 focus:outline-none"
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
      <span className="text-xs font-medium text-gray-500">{props.label}</span>
      <select
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#3b82f6]/60 focus:outline-none"
        value={props.value ?? ""}
        onChange={(e) => props.onChange(e.target.value)}
      >
        <option value="">Sin especificar</option>
        {props.options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
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
      <h4 className="mb-1 text-xs font-semibold text-gray-600">{props.title}</h4>
      <ul className="list-disc space-y-0.5 pl-4 text-xs text-gray-400">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

export function TextareaField(props: { label: string; value: any; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-gray-500">{props.label}</span>
      <textarea
        className="min-h-[80px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#3b82f6]/60 focus:outline-none"
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
      <span className="text-xs font-medium text-gray-500">{props.label}</span>
      <input
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#3b82f6]/60 focus:outline-none"
        placeholder={props.placeholder}
        value={joined}
        onChange={(e) => props.onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
      />
    </label>
  );
}
