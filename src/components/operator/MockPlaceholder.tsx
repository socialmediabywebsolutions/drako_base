// Sustituye a los EmptyState del operator mientras una sección no tiene datos reales:
// muestra cifras de ejemplo realistas, marcadas como tales.

type MockItem = { label: string; value: string; hint?: string };

export default function MockPlaceholder({ items, layout = "grid" }: { items: MockItem[]; layout?: "grid" | "list" }) {
  return (
    <div>
      <span className="mb-3 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        Datos de ejemplo
      </span>
      {layout === "grid" ? (
        <div className="grid grid-cols-2 gap-3">
          {items.map((item) => (
            <div key={item.label}>
              <p className="text-xs text-[var(--muted)]">{item.label}</p>
              <p className="text-xl font-semibold">{item.value}</p>
              {item.hint ? <p className="text-xs text-[var(--muted)]">{item.hint}</p> : null}
            </div>
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {items.map((item) => (
            <li key={item.label} className="flex items-start justify-between gap-3 py-2">
              <span>
                <span className="font-medium text-slate-800">{item.label}</span>
                {item.hint ? <span className="block text-xs text-[var(--muted)]">{item.hint}</span> : null}
              </span>
              <span className="shrink-0 font-semibold text-slate-900">{item.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
