import { queryAll } from "@/lib/db";
import { listDemoClientSaas, listDemoClients, listDemoSaas } from "@/lib/admin/demo-data";

export type OwnerSaasRow = {
  id: string;
  name: string;
  slug: string;
};

export async function listSaasForOwner(tenantId: string, ownerId: string): Promise<OwnerSaasRow[]> {
  const rows = await queryAll<OwnerSaasRow>(
    `SELECT saas.id, saas.name, saas.slug
     FROM saas
     JOIN client_saas ON client_saas.saas_id = saas.id AND client_saas.tenant_id = saas.tenant_id
     JOIN clients ON clients.id = client_saas.client_id AND clients.tenant_id = saas.tenant_id
     WHERE saas.tenant_id = ? AND clients.owner_id = ?
     ORDER BY saas.created_at DESC`,
    tenantId,
    ownerId,
  );
  if (rows.length > 0) return rows;

  const demoClients = listDemoClients(tenantId).filter((client) => client.owner_id === ownerId);
  const demoLinks = listDemoClientSaas(tenantId);
  const demoSaas = listDemoSaas(tenantId);
  const saasIds = new Set(
    demoLinks.filter((link) => demoClients.some((client) => client.id === link.client_id)).map((link) => link.saas_id),
  );
  return demoSaas.filter((item) => saasIds.has(item.id)).map((item) => ({ id: item.id, name: item.name, slug: item.slug }));
}
