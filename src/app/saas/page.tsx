import Link from "next/link";
import { getSaasRegistry } from "@/lib/os/registry";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";
import CreateSaasDialog from "./CreateSaasDialog";

export const runtime = 'edge';

export default async function SaasPortfolioPage() {
  const portfolio = await getSaasRegistry();

  return (
    <div className="space-y-8 p-8 max-w-[1200px] mx-auto">
      <div className="flex justify-between items-end border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">SaaS Registry</h1>
          <p className="text-slate-500 mt-2 font-mono text-sm">Active Instances & Portfolio</p>
        </div>
        <div className="mb-1">
          <CreateSaasDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {portfolio.map((saas) => (
          <Link key={saas.id} href={`/saas/${saas.slug}`} className="group">
            <Card tone="glass" className="h-full hover:border-[var(--brand)] transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="font-bold text-lg text-slate-800 group-hover:text-[var(--brand)]">
                  {saas.name}
                </div>
                <Badge variant={saas.status === 'active' ? 'ok' : 'neutral'}>
                  {saas.status}
                </Badge>
              </div>

              <div className="space-y-2 text-sm text-slate-500 font-mono">
                <div className="flex justify-between">
                  <span>Slug:</span>
                  <span className="text-slate-700">{saas.slug}</span>
                </div>
                <div className="flex justify-between">
                  <span>Plan:</span>
                  <span className="text-slate-700 uppercase">{saas.plan_tier || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span>ID:</span>
                  <span className="text-[10px] text-slate-400 truncate w-32 text-right" title={saas.id}>{saas.id}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 text-xs font-bold text-[var(--brand)] flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                ACCESS CONSOLE <span>→</span>
              </div>
            </Card>
          </Link>
        ))}

        {portfolio.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            No active SaaS instances found in registry.
          </div>
        )}
      </div>
    </div>
  );
}
