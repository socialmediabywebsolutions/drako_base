import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { ensureCampamentoBase } from "@/lib/campamento-base";

export const runtime = "edge";

type Saas = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  subdomain: string | null;
  status: string;
  created_at: string;
};

export async function GET() {
  await ensureCampamentoBase();
  const items = await queryAll<Saas>(
    "SELECT id, name, slug, domain, subdomain, status, created_at FROM saas ORDER BY created_at DESC"
  );
  return NextResponse.json({ items, count: items.length });
}

export async function POST(req: Request) {
  await ensureCampamentoBase();
  const body = (await req.json().catch(() => null)) as {
    name?: string;
    slug?: string;
    domain?: string | null;
  } | null;

  if (!body || !body.name || !body.slug) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }

  const id = (globalThis.crypto?.randomUUID?.() ?? `saas_${Date.now()}`);
  const domain = body.domain ?? null;

  const cleanup = async (records: { alertId?: string | null; provId?: string | null }) => {
    await run("DELETE FROM saas_agents WHERE saas_id = ?", id);
    if (records.alertId) await run("DELETE FROM alerts WHERE id = ?", records.alertId);
    if (records.provId) await run("DELETE FROM provisioning WHERE id = ?", records.provId);
    await run("DELETE FROM saas WHERE id = ?", id);
  };

  const createdRecords: { alertId?: string | null; provId?: string | null } = {};

  try {
    const ok = await run(
      "INSERT INTO saas (id, name, slug, domain, status) VALUES (?, ?, ?, ?, 'inactive')",
      id,
      body.name,
      body.slug,
      domain
    );
    if (!ok) throw new Error("create_saas_failed");

    const alertId = globalThis.crypto?.randomUUID?.() ?? `alert_${Date.now()}`;
    const alertOk = await run(
      "INSERT INTO alerts (id, severity, source, message) VALUES (?, 'info', 'SaaS Creator', ?)",
      alertId,
      `Provisioning initiated for SaaS '${body.name}' (slug: ${body.slug}).`
    );
    if (!alertOk) throw new Error("alert_failed");
    createdRecords.alertId = alertId;

    const provId = globalThis.crypto?.randomUUID?.() ?? `prov_${Date.now()}`;
    const provOk = await run(
      "INSERT INTO provisioning (id, saas_id, step, status, details) VALUES (?, ?, 'init', 'pending', ?)",
      provId,
      id,
      `Queued provisioning for '${body.name}'`
    );
    if (!provOk) throw new Error("prov_failed");
    createdRecords.provId = provId;

    const coreAgents = await queryAll<{ id: string }>("SELECT id FROM core_agents");
    for (const agent of coreAgents) {
      const linkId = `link_${id}_${agent.id}`;
      const assigned = await run(
        "INSERT OR IGNORE INTO saas_agents (id, saas_id, core_agent_id, estado, config) VALUES (?, ?, ?, 'activo', '{}')",
        linkId,
        id,
        agent.id
      );
      if (!assigned) throw new Error("agent_clone_failed");
    }

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    console.error("SAAS_CREATE_ERROR", error);
    await cleanup(createdRecords);
    return NextResponse.json({ error: "No se pudo completar la creación del SaaS" }, { status: 500 });
  }
}
