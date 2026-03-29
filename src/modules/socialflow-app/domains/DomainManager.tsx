"use client";

import { useState, useEffect } from "react";
import { Copy, RefreshCw, Check, AlertTriangle, Lock, Globe, ArrowRight, ShieldCheck } from "lucide-react";
import Button from "@/components/ui/button";
import { TextInput } from "@/components/ui/input";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";

type DomainStatus = 'none' | 'locked' | 'pending' | 'verifying' | 'verified' | 'active' | 'failed' | 'pending_manual';

type DomainData = {
  trial_domain: string;
  custom_domain?: string;
  status: DomainStatus;
  verification?: {
    token: string;
    prefix: string;
    instruction: string;
  };
  last_checked?: string;
  error?: string;
};

type DomainStatusResponse = DomainData;
type DomainMutationResponse = { ok?: boolean; error?: string; message?: string; status?: string };

export default function DomainManager({ saasId }: { saasId: string, saasName: string }) {
  const [data, setData] = useState<DomainData | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [verifying, setVerifying] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/domains/status?saasId=${saasId}`);
      if (res.ok) {
        const json = await res.json() as DomainStatusResponse;
        setData(json);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [saasId]);

  const handleRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setRequesting(true);
    try {
      const res = await fetch("/api/domains/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saasId, domain: newDomain }),
      });
      const json = await res.json() as DomainMutationResponse;
      if (!res.ok) {
        alert(json.error || "Failed");
      } else {
        await fetchStatus();
      }
    } catch {
      alert("Error requesting domain");
    } finally {
      setRequesting(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const res = await fetch("/api/domains/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saasId }),
      });
      const json = await res.json() as DomainMutationResponse;
      if (json.ok) {
        alert(json.message);
        await fetchStatus();
      } else {
        alert(json.message || "Verification failed");
      }
    } catch {
      alert("Error verifying");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return <div className="p-4 text-center text-sm text-[var(--muted)]">Loading Domain Info...</div>;
  if (!data) return null;

  const isLocked = data.status === 'locked';
  const hasCustom = !!data.custom_domain;
  const isActive = data.status === 'active';

  return (
    <div className="space-y-6">
      <Card className="p-6 border-[var(--brand)]/10">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4" /> Trial Domain
        </h3>
        <div className="flex items-center gap-3 bg-[var(--background)] p-3 rounded-md border border-[var(--border)]">
          <code className="text-sm font-mono flex-1 text-[var(--foreground)]">https://{data.trial_domain}</code>
          <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(`https://${data.trial_domain}`)}>
            <Copy className="w-4 h-4" />
          </Button>
          <a
            className="inline-flex items-center gap-1 rounded-full border-2 border-slate-300 bg-transparent px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            href={`https://${data.trial_domain}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open <ArrowRight className="w-3 h-3 ml-1" />
          </a>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2">
          Your instant, always-on development URL.
        </p>
      </Card>
    </div>
  );
}
