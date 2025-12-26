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
  // Obtener tenant activo
  const tenantId = await resolveTenantId();

  // Fetch de datos específicos del tenant (sin usar caché para datos siempre frescos)
  const baseUrl = getServerBaseUrl(await headers());
  const [saasRes, deptRes, inboxRes] = await Promise.all([
    fetch(new URL(`/api/saas?tenantId=${tenantId}`, baseUrl), { cache: "no-store" }),
    fetch(new URL(`/api/departments?tenantId=${tenantId}`, baseUrl), { cache: "no-store" }),
    fetch(new URL(`/api/inbox?tenantId=${tenantId}`, baseUrl), { cache: "no-store" }),
  ]);

  if (!saasRes.ok || !deptRes.ok || !inboxRes.ok) {
    console.error("ADMIN_DATA_ERROR", {
      saasStatus: saasRes.status,
      departmentsStatus: deptRes.status,
      inboxStatus: inboxRes.status,
    });
  }

  const saasData: SaasInfo = saasRes.ok
    ? await saasRes.json()
    : { plan: "Demo", billingDate: "N/A" };
  const departments: Department[] = deptRes.ok ? await deptRes.json() : [];
  const inboxItems: InboxItem[] = inboxRes.ok ? await inboxRes.json() : [];

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
