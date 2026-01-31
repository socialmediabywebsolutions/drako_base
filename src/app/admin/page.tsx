"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Link from "next/link";

interface SaasInfo { plan: string; billingDate: string; }
interface Department { id: number; name: string; }
interface InboxItem { id: number; subject: string; }

export default function AdminPage() {
  const [saasData, setSaasData] = useState<SaasInfo>({ plan: "Cargando...", billingDate: "N/A" });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const correlationId = crypto.randomUUID();

    Promise.all([
      fetch(`/api/saas`, { cache: "no-store" }),
      fetch(`/api/departments`, { cache: "no-store" }),
      fetch(`/api/inbox`, { cache: "no-store" }),
    ])
      .then(async ([saasRes, deptRes, inboxRes]) => {
        if (!saasRes.ok || !deptRes.ok || !inboxRes.ok) {
          setErrorMessage("Some admin data endpoints are unavailable.");
          console.error("ADMIN_DATA_ERROR", {
            correlationId,
            saasStatus: saasRes.status,
            departmentsStatus: deptRes.status,
            inboxStatus: inboxRes.status,
          });
        }

        if (saasRes.ok) setSaasData(await saasRes.json());
        if (deptRes.ok) setDepartments(await deptRes.json());
        if (inboxRes.ok) setInboxItems(await inboxRes.json());
      })
      .catch((error) => {
        setErrorMessage("Admin data loading failed.");
        console.error("ADMIN_DATA_EXCEPTION", { correlationId, error });
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Panel de Administración</h1>
        <p className="text-sm text-[var(--muted)]">Cargando datos...</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Admin Diagnostics</h1>
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
          <p className="font-semibold">We hit an error fetching admin data.</p>
          <p className="text-sm mt-2">{errorMessage}</p>
          <p className="text-xs mt-1 text-red-800">
            Check /api/health and /api/diag for DB/seed status.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Panel de Administración</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="Plan Actual"
          actions={
            <Link href="/saas">
              <Button variant="secondary" size="sm">
                Ver detalles
              </Button>
            </Link>
          }
        >
          <p>
            Plan: <strong>{saasData.plan}</strong>
          </p>
          <p>Próxima factura: {saasData.billingDate}</p>
        </Card>

        <Card
          title="Departamentos"
          actions={
            <Link href="/departments">
              <Button variant="secondary" size="sm">
                Gestionar
              </Button>
            </Link>
          }
        >
          <p>
            Total de departamentos: <strong>{departments.length}</strong>
          </p>
        </Card>

        <Card
          title="Bandeja de Entrada"
          actions={
            <Link href="/inbox">
              <Button variant="secondary" size="sm">
                Abrir bandeja
              </Button>
            </Link>
          }
        >
          <p>
            Mensajes sin leer: <strong>{inboxItems.length}</strong>
          </p>
        </Card>
      </div>
    </div>
  );
}
