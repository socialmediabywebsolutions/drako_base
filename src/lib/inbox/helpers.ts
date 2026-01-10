export type InboxMessage = {
  id: string;
  channel: "email" | "whatsapp";
  direction: "inbound" | "outbound";
  from_address: string;
  to_address: string;
  subject: string | null;
  body_preview: string;
  full_body: string;
  status: "nuevo" | "en_proceso" | "resuelto";
  saas_id: string | null;
  department_id: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
  company_id?: string | null;
};

export type InboxFilterInput = {
  tenantId: string;
  channel?: string | null;
  status?: string | null;
  saasId?: string | null;
  departmentId?: string | null;
};

export function buildInboxQuery(filters: InboxFilterInput): { sql: string; params: string[] } {
  const clauses: string[] = ["tenant_id = ?"];
  const params: string[] = [filters.tenantId];

  if (filters.channel) {
    clauses.push("channel = ?");
    params.push(filters.channel);
  }
  if (filters.status) {
    clauses.push("status = ?");
    params.push(filters.status);
  }
  if (filters.saasId) {
    clauses.push("saas_id = ?");
    params.push(filters.saasId);
  }
  if (filters.departmentId) {
    clauses.push("department_id = ?");
    params.push(filters.departmentId);
  }

  const where = `WHERE ${clauses.join(" AND ")}`;
  const sql = `SELECT id, channel, direction, from_address, to_address, subject, body_preview, full_body, status, saas_id, department_id, tags, created_at, updated_at FROM inbox_messages ${where} ORDER BY datetime(created_at) DESC LIMIT 200`;
  return { sql, params };
}

export function resolveInboxCompanyAlias(body: { saas_id?: string | null; company_id?: string | null }): string | null {
  return body.saas_id ?? body.company_id ?? null;
}

export function enrichInboxItemsWithCompany(items: InboxMessage[]): InboxMessage[] {
  return items.map((item) => ({ ...item, company_id: item.saas_id }));
}
