"use client";

import { useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { TextInput } from "@/components/ui/input";
import Badge from "@/components/ui/badge";
import type { OwnerProfile } from "@/lib/owner/types";

interface CampamentoProfileProps {
    profile: OwnerProfile | null;
    onSave: (data: Partial<OwnerProfile>) => Promise<void>;
}

export default function CampamentoProfile({ profile, onSave }: CampamentoProfileProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<OwnerProfile>>(profile || {});
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(formData);
            setIsEditing(false);
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    if (!profile && !isEditing) {
        return (
            <Card tone="glass" title="Owner Profile" subtitle="Datos legales y fiscales del holding.">
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                    <p className="text-sm text-[var(--muted)]">No hay perfil configurado.</p>
                    <Button variant="brand" onClick={() => setIsEditing(true)}>Configurar ahora</Button>
                </div>
            </Card>
        )
    }

    if (isEditing) {
        return (
            <Card tone="glass" title="Editando Perfil" subtitle="Asegúrate de que los datos fiscales sean correctos.">
                <div className="space-y-4">
                    <input
                        placeholder="Razón Social / Nombre"
                        value={formData.name || ""}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            placeholder="NIF / CIF"
                            value={formData.nif || ""}
                            onChange={e => setFormData({ ...formData, nif: e.target.value })}
                            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
                        />
                        <input
                            placeholder="Email (Facturación)"
                            value={formData.email || ""}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
                        />
                    </div>
                    <input
                        placeholder="Dirección Fiscal"
                        value={formData.address || ""}
                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                        className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            placeholder="Ciudad"
                            value={formData.city || ""}
                            onChange={e => setFormData({ ...formData, city: e.target.value })}
                            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
                        />
                        <input
                            placeholder="País"
                            value={formData.country || ""}
                            onChange={e => setFormData({ ...formData, country: e.target.value })}
                            className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-[var(--text)]"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>Cancelar</Button>
                        <Button variant="brand" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : "Guardar Cambios"}</Button>
                    </div>
                </div>
            </Card>
        );
    }

    // View Mode
    const isComplete = profile?.name && profile?.nif && profile.address;

    return (
        <Card tone="glass" title="Owner Profile" subtitle="Entidad legal principal del holding.">
            <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--text)]">{profile?.name}</h3>
                        <p className="text-sm font-mono text-[var(--muted)]">{profile?.nif}</p>
                    </div>
                    {!isComplete && <Badge variant="err">DATOS INCOMPLETOS</Badge>}
                    {isComplete && <Badge variant="ok">VERIFICADO</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">Dirección</p>
                        <p className="whitespace-pre-wrap text-[var(--text)]">{profile?.address}</p>
                        <p className="text-[var(--text)]">{profile?.city}, {profile?.country}</p>
                    </div>
                    <div>
                        <p className="text-xs uppercase tracking-wider text-[var(--muted)]">Contacto</p>
                        <p className="text-[var(--text)]">{profile?.email}</p>
                        <p className="text-[var(--text)]">{profile?.phone}</p>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                    <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>Editar datos</Button>
                </div>
            </div>
        </Card>
    );
}
