"use client";

import { useState } from "react";
import { Download, ShieldCheck, AlertTriangle } from "lucide-react";

export default function SocialFlowOwnershipPage() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);

      const link = document.createElement("a");
      link.href = "/api/socialflow/exports/current";
      link.download = "socialflow-export.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error(error);
      alert("Error initiating download.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-black text-slate-800">Ownership & Assets</h1>
        <p className="mt-1 text-sm text-slate-500">Manage legal ownership, exports, and intellectual property rights.</p>
      </div>

      <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="absolute right-0 top-0 p-4 opacity-5">
          <Download className="h-24 w-24" />
        </div>

        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          My Assets
        </h2>

        <div className="prose prose-sm mb-6 text-slate-600">
          <p>
            Drako Infrastructure guarantees that you own your data and architecture.
            You can download a full compliance package at any time. This package includes:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Strategic Dossier:</strong> Your business DNA and analysis.</li>
            <li><strong>Engineering Blueprint:</strong> The architectural map of your software.</li>
            <li><strong>Execution Logs:</strong> Proof of work for all AI agents.</li>
            <li><strong>Financials:</strong> Economic events and cost breakdowns.</li>
          </ul>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Full Export</div>
            <div className="text-sm font-medium text-slate-900">Standard Wipeout Package (.zip)</div>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {downloading ? (
              <>
                <span className="animate-spin">...</span>
                Compressing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download Full Backup
              </>
            )}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 opacity-75 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Transfer Ownership
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Transferring ownership of this SaaS infrastructure requires legal validation and a new billing contract.
          This process is irreversible.
        </p>
        <div className="rounded border border-amber-100 bg-amber-50 p-4 text-xs text-amber-800">
          <strong>Notice:</strong> Automated ownership transfer is currently disabled for security reasons.
          Please contact Enterprise Support to initiate a holding transfer.
        </div>
      </section>
    </div>
  );
}
