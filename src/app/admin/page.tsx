// app/admin/page.tsx
import { resolveTenantId } from "@/lib/tenants/services";
import { getServerBaseUrl } from "@/lib/http/base-url";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Link from "next/link";
import { headers } from "next/headers";

interface SaasInfo { plan: string; billingDate: string; }
interface Department { id: number; name: string; }
interface InboxItem { id: number; subject: string; }

export default async function AdminPage() {
  const correlationId = globalThis.crypto?.randomUUID?.() ?? `admin_${Date.now()}`;
  const baseUrl = getServerBaseUrl(await headers());

  let saasData: SaasInfo = { plan: "Demo", billingDate: "N/A" };
  let departments: Department[] = [];
  let inboxItems: InboxItem[] = [];
  let errorMessage: string | null = null;

  try {
    const tenantId = await resolveTenantId();
    const [saasRes, deptRes, inboxRes] = await Promise.all([
      fetch(new URL(`/api/saas?tenantId=${tenantId}`, baseUrl), { cache: "no-store" }),
      fetch(new URL(`/api/departments?tenantId=${tenantId}`, baseUrl), { cache: "no-store" }),
      fetch(new URL(`/api/inbox?tenantId=${tenantId}`, baseUrl), { cache: "no-store" }),
    ]);

    if (!saasRes.ok || !deptRes.ok || !inboxRes.ok) {
      errorMessage = "Some admin data endpoints are unavailable.";
      console.error("ADMIN_DATA_ERROR", {
        correlationId,
        saasStatus: saasRes.status,
        departmentsStatus: deptRes.status,
        inboxStatus: inboxRes.status,
      });
    }

    if (saasRes.ok) saasData = await saasRes.json();
    if (deptRes.ok) departments = await deptRes.json();
    if (inboxRes.ok) inboxItems = await inboxRes.json();
  } catch (error) {
    errorMessage = "Admin data loading failed.";
    console.error("ADMIN_DATA_EXCEPTION", { correlationId, error });
  }

  if (errorMessage) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Admin Diagnostics</h1>
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
          <p className="font-semibold">We hit an error fetching admin data.</p>
          <p className="text-sm mt-2">{errorMessage}</p>
          <p className="text-xs mt-2 text-red-800">
            correlationId: <code>{correlationId}</code> · host: {baseUrl}
          </p>
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
