import { resolveSocialContext } from "@/lib/socialflow/repository";

export type ChecklistItem = {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  href: string;
};

export type EmpresaChecklistResult = {
  items: ChecklistItem[];
  completedCount: number;
  totalCount: number;
};

async function countRows(
  db: Awaited<ReturnType<typeof resolveSocialContext>>["socialDb"],
  sql: string,
  binds: unknown[],
): Promise<number> {
  const row = await db.prepare(sql).bind(...binds).first<{ cnt: number }>();
  return row?.cnt ?? 0;
}

export async function getEmpresaChecklist(tenantId: string, saasId: string): Promise<EmpresaChecklistResult> {
  const ctx = await resolveSocialContext({ tenantId, saasId });
  const db = ctx.socialDb;

  const [
    instagramCount,
    catalogCount,
    localRow,
    localPhotosCount,
    employeesCount,
    profileRow,
    campaignsCount,
    scheduledPostsCount,
  ] = await Promise.all([
    countRows(
      db,
      `SELECT COUNT(*) as cnt FROM saas_social_accounts WHERE tenant_id = ? AND saas_id = ? AND provider = 'INSTAGRAM' AND status = 'CONNECTED_REAL'`,
      [tenantId, saasId],
    ),
    countRows(
      db,
      `SELECT COUNT(*) as cnt FROM socialflow_knowledge_documents WHERE tenant_id = ? AND saas_id = ? AND type = 'catalog'`,
      [tenantId, saasId],
    ),
    db
      .prepare(`SELECT business_name FROM saas_empresa_local WHERE tenant_id = ? AND saas_id = ?`)
      .bind(tenantId, saasId)
      .first<{ business_name: string | null }>(),
    countRows(
      db,
      `SELECT COUNT(*) as cnt FROM saas_empresa_local_photos WHERE tenant_id = ? AND saas_id = ?`,
      [tenantId, saasId],
    ),
    countRows(
      db,
      `SELECT COUNT(*) as cnt FROM saas_empresa_employees WHERE tenant_id = ? AND saas_id = ? AND active = 1`,
      [tenantId, saasId],
    ),
    db
      .prepare(`SELECT client_objective FROM socialflow_profiles WHERE tenant_id = ? AND saas_id = ?`)
      .bind(tenantId, saasId)
      .first<{ client_objective: string | null }>(),
    countRows(
      db,
      `SELECT COUNT(*) as cnt FROM saas_social_campaigns WHERE tenant_id = ? AND saas_id = ?`,
      [tenantId, saasId],
    ),
    countRows(
      db,
      `SELECT COUNT(*) as cnt FROM saas_social_posts WHERE tenant_id = ? AND saas_id = ? AND status IN ('SCHEDULED','APPROVED')`,
      [tenantId, saasId],
    ),
  ]);

  const items: ChecklistItem[] = [
    {
      id: "instagram",
      label: "Conectar Instagram",
      description: "Conecta tu cuenta de Instagram para poder publicar directamente desde Socialcors.",
      completed: instagramCount > 0,
      href: "/socialflow/redes",
    },
    {
      id: "catalog",
      label: "Subir catálogo/precios/servicios",
      description: "Sube un CSV o Excel con tus productos o servicios para que la IA los conozca.",
      completed: catalogCount > 0,
      href: "/socialflow/knowledge",
    },
    {
      id: "local",
      label: "Configurar Mi Local",
      description: "Añade la información de tu negocio y al menos una foto de tu local.",
      completed: Boolean(localRow?.business_name?.trim()) && localPhotosCount > 0,
      href: "/socialflow/empresa/local",
    },
    {
      id: "employees",
      label: "Añadir empleados",
      description: "Registra a tu equipo para que la IA los reconozca en las fotos.",
      completed: employeesCount > 0,
      href: "/socialflow/empresa/empleados",
    },
    {
      id: "objective",
      label: "Configurar objetivo de contenido",
      description: "Define si buscas followers, engagement, leads o ventas.",
      completed: Boolean(profileRow?.client_objective?.trim()),
      href: "/socialflow/profile",
    },
    {
      id: "campaign",
      label: "Crear primera campaña",
      description: "Lanza tu primera campaña para organizar tu contenido por objetivo.",
      completed: campaignsCount > 0,
      href: "/socialflow/campaigns",
    },
    {
      id: "auto_publish",
      label: "Activar publicación automática",
      description: "Programa al menos un post — Socialcors lo publica solo, sin que tengas que hacer nada más.",
      completed: scheduledPostsCount > 0,
      href: "/socialflow/plan",
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  return { items, completedCount, totalCount: items.length };
}
