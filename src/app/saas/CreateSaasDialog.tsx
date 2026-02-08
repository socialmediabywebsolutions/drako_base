"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, ArrowRight } from "lucide-react";
import Button from "@/components/ui/button";
import { TextInput } from "@/components/ui/input";
import Card from "@/components/ui/card";

export default function CreateSaasDialog() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleNameChange = (val: string) => {
        setName(val);
        if (!slug) {
            setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/saas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, slug }),
            });
            const data = (await res.json()) as { slug?: string; error?: string };

            if (!res.ok) {
                throw new Error(data.error || "Failed to create SaaS");
            }

            // Success
            setIsOpen(false);
            setName("");
            setSlug("");
            if (data.slug) {
                router.push(`/saas/${data.slug}`);
            }
            router.refresh();

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button onClick={() => setIsOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Construct New Vertical
            </Button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md animate-in zoom-in-95 duration-200">
                        <Card tone="glass" className="relative shadow-2xl border-[var(--brand)]/20">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-4 right-4 text-[var(--muted)] hover:text-foreground transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="mb-6">
                                <h2 className="text-xl font-bold tracking-tight">Construct Vertical</h2>
                                <p className="text-sm text-[var(--muted)]">
                                    Initialize a new SaaS instance in the registry.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                                        Vertical Name
                                    </label>
                                    <TextInput
                                        placeholder="e.g. Legal AI"
                                        value={name}
                                        onChange={(e) => handleNameChange(e.target.value)}
                                        disabled={loading}
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                                        Slug (URL)
                                    </label>
                                    <TextInput
                                        placeholder="e.g. legal-ai"
                                        value={slug}
                                        onChange={(e) => setSlug(e.target.value)}
                                        disabled={loading}
                                        className="font-mono text-sm"
                                    />
                                    <p className="text-[10px] text-[var(--muted)] text-right">
                                        {slug ? `drako.systems/saas/${slug}` : "Unique identifier"}
                                    </p>
                                </div>

                                {error && (
                                    <div className="p-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-md">
                                        {error}
                                    </div>
                                )}

                                <div className="pt-4 flex justify-end gap-3">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setIsOpen(false)}
                                        disabled={loading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={!name || !slug || loading}>
                                        {loading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Constructing...
                                            </>
                                        ) : (
                                            <>
                                                Materialize <ArrowRight className="w-4 h-4 ml-2" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </form>
                        </Card>
                    </div>
                </div>
            )}
        </>
    );
}
