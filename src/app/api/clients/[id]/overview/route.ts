export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { queryAll } from "@/lib/db";
import { buildOwnerControlSnapshot } from "@/lib/owner/control-dashboard";
import { resolveTasksContext, listTasks } from "@/lib/tasks/repository";
import { listDemoClients, listDemoClientSaas, listDemoSaas } from "@/lib/admin/demo-data";



type ClientRow = {
  id: string;
  owner_id: string;
  name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  created_at: string;
};

type SaasRow = {
  id: string;
  name: string;
  slug: string;
};

type ClientSaasLink = {
  saas_id: string;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const { id: clientId } = await params;
    const clientRows = await queryAll<ClientRow>(
      `SELECT id, owner_id, name, nif, email, phone, country, city, address, created_at
       FROM clients
       WHERE id = ? AND tenant_id = ?
       LIMIT 1`,
      clientId,
      tenantId,
    );
    let client = clientRows[0];
    let saasList: SaasRow[] = [];
    if (!client) {
      const demoClient = listDemoClients(tenantId).find((item) => item.id === clientId);
      if (!demoClient) {
        return NextResponse.json({ code: "NOT_FOUND", message: "Client not found" }, { status: 404 });
      }
      client = {
        id: demoClient.id,
        owner_id: demoClient.owner_id,
        name: demoClient.name,
        nif: demoClient.nif,
        email: demoClient.email,
        phone: demoClient.phone,
        country: demoClient.country,
        city: demoClient.city,
        address: demoClient.address,
        created_at: demoClient.created_at,
      };
      const demoLinks = listDemoClientSaas(tenantId).filter((link) => link.client_id === clientId);
      const demoSaas = listDemoSaas(tenantId);
      const saasIds = new Set(demoLinks.map((link) => link.saas_id));
      saasList = demoSaas.filter((item) => saasIds.has(item.id)).map((item) => ({ id: item.id, name: item.name, slug: item.slug }));
    } else {
      const links = await queryAll<ClientSaasLink>(
        `SELECT saas_id FROM client_saas WHERE tenant_id = ? AND client_id = ?`,
        tenantId,
        clientId,
      );
      const saasIds = links.map((link) => link.saas_id);
      saasList = saasIds.length
        ? await queryAll<SaasRow>(
            `SELECT id, name, slug FROM saas WHERE tenant_id = ? AND id IN (${saasIds.map(() => "?").join(", ")})`,
            tenantId,
            ...saasIds,
          )
        : [];
    }

    const saas = await Promise.all(
      saasList.map(async (item) => {
        const snapshot = await buildOwnerControlSnapshot({ tenantId, saasId: item.id });
        const tasksCtx = await resolveTasksContext({ tenantId, saasId: item.id });
        const openTasks = await listTasks(tasksCtx, { status: "OPEN" });
        const hrFairnessStatus =
          snapshot.hr.criticalIssues.length > 0
            ? "CRITICAL"
            : snapshot.hr.overworkedCount > 0 || snapshot.hr.underpaidCount > 0
              ? "WARNING"
              : "OK";
        const employeesRoiStatus =
          snapshot.employeesProfitabilitySummary?.tightCount || snapshot.employeesProfitabilitySummary?.unprofitableCount
            ? "TIGHT"
            : snapshot.employeesProfitabilitySummary?.lowActivityCount
              ? "LOW_ACTIVITY"
              : "HEALTHY";
        const socialRoiStatus =
          snapshot.socialConversion?.totalRevenueFromSocial && snapshot.socialConversion.totalRevenueFromSocial > 0
            ? "GOOD"
            : snapshot.social?.accountsConnected
              ? "NEUTRAL"
              : "POOR";
        return {
          saasId: item.id,
          name: item.name,
          verticalPack: snapshot.currentPack
            ? { id: snapshot.currentPack.id, label: snapshot.currentPack.label }
            : undefined,
          keyMetrics: {
            marginPercent: snapshot.economy.marginPercentEstimated ?? undefined,
            hrFairnessStatus,
            employeesRoiStatus,
            socialRoiStatus,
          },
          tasksSummary: {
            openTasks: openTasks.length,
          },
        };
      }),
    );

    return NextResponse.json({
      clientId: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      saas,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("CLIENT_OVERVIEW_ERROR", error);
    return NextResponse.json({ code: "CLIENT_OVERVIEW_ERROR", message: "No se pudo cargar el overview" }, { status: 500 });
  }
}
