'use client';

import React, { useState } from 'react';
import { Download, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function SocialFlowOwnershipPage() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setDownloading(true);

      const link = document.createElement('a');
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
        <p className="text-slate-500 text-sm mt-1">Manage legal ownership, exports, and intellectual property rights.</p>
      </div>

      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Download className="w-24 h-24" />
        </div>

        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-green-600" />
          My Assets
        </h2>

        <div className="prose prose-sm text-slate-600 mb-6">
          <p>
            Drako Infrastructure guarantees that you own your data and architecture.
            You can download a full compliance package at any time. This package includes:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Strategic Dossier:</strong> Your business DNA and analysis.</li>
            <li><strong>Engineering Blueprint:</strong> The architectural map of your software.</li>
            <li><strong>Execution Logs:</strong> Proof of work for all AI agents.</li>
            <li><strong>Financials:</strong> Economic events and cost breakdowns.</li>
          </ul>
        </div>

        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-1">Full Export</div>
            <div className="text-sm font-medium text-slate-900">Standard Wipeout Package (.zip)</div>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {downloading ? (
              <>
                <span className="animate-spin">⏳</span>
                Compressing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download Full Backup
              </>
            )}
          </button>
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm opacity-75">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Transfer Ownership
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Transferring ownership of this SaaS infrastructure requires legal validation and a new billing contract.
          This process is irreversible.
        </p>
        <div className="bg-amber-50 border border-amber-100 p-4 rounded text-xs text-amber-800">
          <strong>Notice:</strong> Automated ownership transfer is currently disabled for security reasons.
          Please contact Enterprise Support to initiate a holding transfer.
        </div>
      </section>
    </div>
  );
}
