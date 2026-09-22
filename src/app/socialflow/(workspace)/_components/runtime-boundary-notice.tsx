type RuntimeBoundaryNoticeProps = {
  title: string;
  description: string;
  details: string;
};

export default function RuntimeBoundaryNotice({
  title,
  description,
  details,
}: RuntimeBoundaryNoticeProps) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#3b82f6]">Socialcors</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">{description}</p>
      </div>
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-800">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 mb-3">
          No disponible en runtime aislado
        </p>
        <p className="leading-6 text-amber-800/90">{details}</p>
      </section>
    </div>
  );
}
