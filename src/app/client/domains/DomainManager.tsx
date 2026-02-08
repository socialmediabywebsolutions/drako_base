"use client";

import { useState, useEffect } from "react";
import { Copy, Plus, RefreshCw, Check, AlertTriangle, Lock, Globe, ArrowRight, ShieldCheck } from "lucide-react";
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

export default function DomainManager({ saasId, saasName }: { saasId: string, saasName: string }) {
    const [data, setData] = useState<DomainData | null>(null);
    const [loading, setLoading] = useState(true);
    const [requesting, setRequesting] = useState(false);
    const [newDomain, setNewDomain] = useState("");
    const [verifying, setVerifying] = useState(false);

    const fetchStatus = async () => {
        try {
            const res = await fetch(`/api/domains/status?saasId=${saasId}`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, [saasId]);

    const handleRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setRequesting(true);
        try {
            const res = await fetch("/api/domains/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ saasId, domain: newDomain }),
            });
            const json = await res.json();
            if (!res.ok) {
                alert(json.error || "Failed");
            } else {
                await fetchStatus();
            }
        } catch (err) {
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
            const json = await res.json();
            if (json.ok) {
                alert(json.message);
                await fetchStatus();
            } else {
                alert(json.message || "Verification failed");
            }
        } catch (err) {
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

            {/* Trial Domain */}
            <Card className="p-6 border-[var(--brand)]/10">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)] mb-4 flex items-center gap-2">
                    <Globe className="w-4 h-4" /> Trial Domain
                </h3>
                <div className="flex items-center gap-3 bg-[var(--background)] p-3 rounded-md border border-[var(--border)]">
                    <code className="text-sm font-mono flex-1 text-[var(--foreground)]">https://{data.trial_domain}</code>
                    <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(`https://${data.trial_domain}`)}>
                        <Copy className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                        <a href={`https://${data.trial_domain}`} target="_blank" rel="noopener noreferrer">
                            Open <ArrowRight className="w-3 h-3 ml-1" />
                        </a>
                    </Button>
                </div>
                <p className="text-xs text-[var(--muted)] mt-2">
                    Your instant, always-on development URL.
                </p>
            </Card>

            {/* Custom Domain */}
            <Card className="p-6 relative overflow-hidden">
                {isLocked && (
                    <div className="absolute inset-0 bg-gray-50/80 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center text-center p-6">
                        <div className="bg-white p-4 rounded-full shadow-lg mb-3">
                            <Lock className="w-6 h-6 text-slate-400" />
                        </div>
                        <h3 className="font-bold text-slate-900">Custom Domains are Locked</h3>
                        <p className="text-sm text-slate-500 max-w-xs mt-1 mb-4">
                            Upgrade your plan to connect your own domain (e.g. app.yourcompany.com).
                        </p>
                        <Button>Upgrade to Pro</Button>
                    </div>
                )}

                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold tracking-tight text-[var(--foreground)] flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-[var(--brand)]" /> Custom Domain
                    </h3>
                    {hasCustom && (
                        <Badge variant={isActive ? "default" : "outline"} className={isActive ? "bg-green-500 hover:bg-green-600" : "text-yellow-600 border-yellow-200 bg-yellow-50"}>
                            {data.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                    )}
                </div>

                {!hasCustom ? (
                    <form onSubmit={handleRequest} className="space-y-4">
                        <p className="text-sm text-[var(--muted)]">Connect your own domain to white-label this vertical.</p>
                        <div className="flex gap-3">
                            <TextInput
                                placeholder="e.g. app.client.com"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                                disabled={requesting}
                                className="flex-1"
                            />
                            <Button type="submit" disabled={!newDomain || requesting}>
                                {requesting ? "Requesting..." : "Connect Domain"}
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between bg-[var(--background)] p-4 rounded-lg border border-[var(--border)]">
                            <span className="font-mono font-bold text-lg">{data.custom_domain}</span>
                            {isActive && (
                                <div className="flex items-center text-green-600 text-sm font-medium">
                                    <Check className="w-4 h-4 mr-1" /> Active & Secured
                                </div>
                            )}
                        </div>

                        {!isActive && data.verification && (
                            <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="bg-blue-100 p-2 rounded text-blue-600 mt-1">
                                        <RefreshCw className="w-4 h-4 animate-spin-slow" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-blue-900 text-sm">Verification Required</h4>
                                        <p className="text-xs text-blue-700 mt-1">
                                            Add the following TXT record to your DNS provider (Cloudflare, GoDaddy, etc.) to prove ownership.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-[100px_1fr] gap-2 text-xs mt-3">
                                    <div className="font-semibold text-slate-500 py-2">Type</div>
                                    <div className="font-mono bg-white border px-3 py-2 rounded">TXT</div>

                                    <div className="font-semibold text-slate-500 py-2">Name / Host</div>
                                    <div className="font-mono bg-white border px-3 py-2 rounded flex justify-between items-center group">
                                        {data.verification.prefix}
                                        <button onClick={() => navigator.clipboard.writeText(data.verification!.prefix)} className="opacity-0 group-hover:opacity-100">
                                            <Copy className="w-3 h-3 text-slate-400" />
                                        </button>
                                    </div>

                                    <div className="font-semibold text-slate-500 py-2">Value</div>
                                    <div className="font-mono bg-white border px-3 py-2 rounded flex justify-between items-center group break-all">
                                        {data.verification.token}
                                        <button onClick={() => navigator.clipboard.writeText(data.verification!.token)} className="opacity-0 group-hover:opacity-100 ml-2">
                                            <Copy className="w-3 h-3 text-slate-400" />
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-2 flex justify-end">
                                    <Button size="sm" onClick={handleVerify} disabled={verifying}>
                                        {verifying ? "Checking DNS..." : "Verify DNS Records"}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {data.error && (
                            <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs rounded border border-red-100 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold">Error:</p>
                                    <p>{data.error}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Help / Docs */}
            <p className="text-xs text-[var(--muted)] text-center">
                Changes to DNS records can take up to 24-48 hours to propagate, although it usually happens within minutes.
            </p>
        </div>
    );
}
