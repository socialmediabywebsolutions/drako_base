"use client";

import { useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { TextInput, TextArea } from "@/components/ui/input";

type LegacyFiscalFormProps = {
    loading: boolean;
    saving: boolean;
    message: string | null;
    name: string;
    nif: string;
    address: string;
    email: string;
    phone: string;
    onNameChange: (value: string) => void;
    onNifChange: (value: string) => void;
    onAddressChange: (value: string) => void;
    onEmailChange: (value: string) => void;
    onPhoneChange: (value: string) => void;
    onSave: () => void;
    enabled?: boolean;
};

export default function LegacyFiscalForm({
    loading,
    saving,
    message,
    name,
    nif,
    address,
    email,
    phone,
    onNameChange,
    onNifChange,
    onAddressChange,
    onEmailChange,
    onPhoneChange,
    onSave,
    enabled = false,
}: LegacyFiscalFormProps) {
    if (!enabled) return null;

    return (
        <Card tone="glass" title="Datos fiscales" subtitle="Información usada en facturación">
            {loading ? (
                <p className="text-sm text-[var(--muted)]">Cargando datos...</p>
            ) : (
                <form
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    onSubmit={(evt) => {
                        evt.preventDefault();
                        onSave();
                    }}
                >
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-[var(--muted)]">Nombre / razón social</span>
                        <TextInput value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="DRĀKO Systems" required />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-[var(--muted)]">NIF / CIF</span>
                        <TextInput value={nif} onChange={(e) => onNifChange(e.target.value)} placeholder="B12345678" />
                    </label>
                    <label className="flex flex-col gap-1 text-sm md:col-span-2">
                        <span className="text-[var(--muted)]">Dirección fiscal</span>
                        <TextArea value={address} onChange={(e) => onAddressChange(e.target.value)} placeholder="Dirección completa" rows={3} />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-[var(--muted)]">Email de facturación</span>
                        <TextInput type="email" value={email} onChange={(e) => onEmailChange(e.target.value)} placeholder="admin@drako.systems" />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="text-[var(--muted)]">Teléfono</span>
                        <TextInput value={phone} onChange={(e) => onPhoneChange(e.target.value)} placeholder="+34 600 000 000" />
                    </label>
                    <div className="md:col-span-2 flex items-center justify-between">
                        <span className="text-sm text-[var(--muted)]">
                            {message ?? "Estos datos se usarán en la facturación generada desde DRĀKO BASE."}
                        </span>
                        <Button type="submit" disabled={saving}>
                            {saving ? "Guardando..." : "Guardar"}
                        </Button>
                    </div>
                </form>
            )}
        </Card>
    );
}
