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
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">SocialFlow runtime boundary</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Unavailable in isolated runtime</div>
        <p className="mt-3 leading-6">{details}</p>
      </section>
    </div>
  );
}
