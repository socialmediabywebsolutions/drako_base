import type { SocialFlowProspect, SocialFlowCampaign, ProspectStatus, ProspectSource } from "./types";

// ─── Schema auto-creation ─────────────────────────────────────────────────────

const schemaCache = new WeakMap<D1Database, Promise<void>>();

async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaCache.has(db)) return schemaCache.get(db);
  const p = db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS socialflow_campaigns (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      saas_id TEXT NOT NULL,
      name TEXT NOT NULL,
      niche TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      prospect_count INTEGER NOT NULL DEFAULT 0,
      email_sent_count INTEGER NOT NULL DEFAULT 0,
      replied_count INTEGER NOT NULL DEFAULT 0,
      converted_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS socialflow_prospects (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      saas_id TEXT NOT NULL,
      campaign_id TEXT,
      business_name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      whatsapp TEXT,
      website TEXT,
      instagram_handle TEXT,
      niche TEXT NOT NULL,
      location TEXT NOT NULL,
      description TEXT,
      source TEXT NOT NULL DEFAULT 'AI_GENERATED',
      rating REAL,
      review_count INTEGER,
      status TEXT NOT NULL DEFAULT 'DISCOVERED',
      outreach_count INTEGER NOT NULL DEFAULT 0,
      last_outreach_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_prospects_tenant ON socialflow_prospects(tenant_id, status)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON socialflow_campaigns(tenant_id)`),
  ]).then(() => undefined);
  schemaCache.set(db, p);
  return p;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowIso() { return new Date().toISOString(); }

function uid() {
  try { return globalThis.crypto?.randomUUID?.() ?? fallbackId(); }
  catch { return fallbackId(); }
}
function fallbackId() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }

type ProspectRow = {
  id: string; tenant_id: string; saas_id: string; campaign_id: string | null;
  business_name: string; contact_name: string | null; email: string | null;
  phone: string | null; whatsapp: string | null; website: string | null;
  instagram_handle: string | null; niche: string; location: string;
  description: string | null; source: string; rating: number | null;
  review_count: number | null; status: string; outreach_count: number;
  last_outreach_at: string | null; notes: string | null;
  created_at: string; updated_at: string;
};

function rowToProspect(r: ProspectRow): SocialFlowProspect {
  return {
    id: r.id, tenantId: r.tenant_id, saasId: r.saas_id, campaignId: r.campaign_id,
    businessName: r.business_name, contactName: r.contact_name, email: r.email,
    phone: r.phone, whatsapp: r.whatsapp, website: r.website,
    instagramHandle: r.instagram_handle, niche: r.niche, location: r.location,
    description: r.description, source: r.source as ProspectSource,
    rating: r.rating, reviewCount: r.review_count,
    status: r.status as ProspectStatus, outreachCount: r.outreach_count,
    lastOutreachAt: r.last_outreach_at, notes: r.notes,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

type CampaignRow = {
  id: string; tenant_id: string; saas_id: string; name: string;
  niche: string; location: string; status: string;
  prospect_count: number; email_sent_count: number; replied_count: number;
  converted_count: number; created_at: string; updated_at: string;
};

function rowToCampaign(r: CampaignRow): SocialFlowCampaign {
  return {
    id: r.id, tenantId: r.tenant_id, saasId: r.saas_id, name: r.name,
    niche: r.niche, location: r.location, status: r.status as "ACTIVE" | "PAUSED" | "COMPLETED",
    prospectCount: r.prospect_count, emailSentCount: r.email_sent_count,
    repliedCount: r.replied_count, convertedCount: r.converted_count,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

export async function createCampaign(
  db: D1Database,
  params: { tenantId: string; saasId: string; name: string; niche: string; location: string }
): Promise<SocialFlowCampaign> {
  await ensureSchema(db);
  const now = nowIso();
  const id = uid();
  await db.prepare(
    `INSERT INTO socialflow_campaigns (id,tenant_id,saas_id,name,niche,location,status,prospect_count,email_sent_count,replied_count,converted_count,created_at,updated_at)
     VALUES (?,?,?,?,?,?,'ACTIVE',0,0,0,?,?)`
  ).bind(id, params.tenantId, params.saasId, params.name, params.niche, params.location, now, now).run();
  return {
    id, tenantId: params.tenantId, saasId: params.saasId, name: params.name,
    niche: params.niche, location: params.location, status: "ACTIVE",
    prospectCount: 0, emailSentCount: 0, repliedCount: 0, convertedCount: 0,
    createdAt: now, updatedAt: now,
  };
}

export async function listCampaigns(
  db: D1Database,
  tenantId: string
): Promise<SocialFlowCampaign[]> {
  await ensureSchema(db);
  const rows = await db.prepare(
    `SELECT * FROM socialflow_campaigns WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 50`
  ).bind(tenantId).all<CampaignRow>();
  return (rows.results ?? []).map(rowToCampaign);
}

export async function incrementCampaignStat(
  db: D1Database,
  campaignId: string,
  field: "prospect_count" | "email_sent_count" | "replied_count" | "converted_count"
): Promise<void> {
  await db.prepare(
    `UPDATE socialflow_campaigns SET ${field} = ${field} + 1, updated_at = ? WHERE id = ?`
  ).bind(nowIso(), campaignId).run();
}

// ─── Prospects ────────────────────────────────────────────────────────────────

export async function bulkInsertProspects(
  db: D1Database,
  prospects: Omit<SocialFlowProspect, "id" | "status" | "outreachCount" | "lastOutreachAt" | "createdAt" | "updatedAt">[]
): Promise<SocialFlowProspect[]> {
  await ensureSchema(db);
  const now = nowIso();
  const created: SocialFlowProspect[] = [];
  for (const p of prospects) {
    const id = uid();
    await db.prepare(
      `INSERT OR IGNORE INTO socialflow_prospects
       (id,tenant_id,saas_id,campaign_id,business_name,contact_name,email,phone,whatsapp,website,instagram_handle,niche,location,description,source,rating,review_count,status,outreach_count,last_outreach_at,notes,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'DISCOVERED',0,NULL,NULL,?,?)`
    ).bind(
      id, p.tenantId, p.saasId, p.campaignId ?? null,
      p.businessName, p.contactName ?? null, p.email ?? null,
      p.phone ?? null, p.whatsapp ?? null, p.website ?? null,
      p.instagramHandle ?? null, p.niche, p.location,
      p.description ?? null, p.source, p.rating ?? null, p.reviewCount ?? null,
      now, now
    ).run();
    created.push({ ...p, id, status: "DISCOVERED", outreachCount: 0, lastOutreachAt: null, createdAt: now, updatedAt: now });
  }
  return created;
}

export async function listProspects(
  db: D1Database,
  tenantId: string,
  opts: { campaignId?: string; status?: ProspectStatus; limit?: number } = {}
): Promise<SocialFlowProspect[]> {
  await ensureSchema(db);
  const limit = Math.min(opts.limit ?? 100, 500);
  let sql = `SELECT * FROM socialflow_prospects WHERE tenant_id = ?`;
  const bindings: unknown[] = [tenantId];
  if (opts.campaignId) { sql += ` AND campaign_id = ?`; bindings.push(opts.campaignId); }
  if (opts.status) { sql += ` AND status = ?`; bindings.push(opts.status); }
  sql += ` ORDER BY created_at DESC LIMIT ${limit}`;
  const rows = await db.prepare(sql).bind(...bindings).all<ProspectRow>();
  return (rows.results ?? []).map(rowToProspect);
}

export async function getProspect(db: D1Database, id: string, tenantId: string): Promise<SocialFlowProspect | null> {
  await ensureSchema(db);
  const row = await db.prepare(`SELECT * FROM socialflow_prospects WHERE id = ? AND tenant_id = ?`).bind(id, tenantId).first<ProspectRow>();
  return row ? rowToProspect(row) : null;
}

export async function updateProspectStatus(
  db: D1Database,
  id: string,
  tenantId: string,
  status: ProspectStatus,
  notes?: string
): Promise<void> {
  const now = nowIso();
  const notesSql = notes !== undefined ? `, notes = ?` : "";
  const bindings = notes !== undefined
    ? [status, now, notes, id, tenantId]
    : [status, now, id, tenantId];
  await db.prepare(
    `UPDATE socialflow_prospects SET status = ?, updated_at = ?${notesSql} WHERE id = ? AND tenant_id = ?`
  ).bind(...bindings).run();
}

export async function recordOutreach(
  db: D1Database,
  id: string,
  tenantId: string,
  newStatus: ProspectStatus
): Promise<void> {
  const now = nowIso();
  await db.prepare(
    `UPDATE socialflow_prospects
     SET status = ?, outreach_count = outreach_count + 1, last_outreach_at = ?, updated_at = ?
     WHERE id = ? AND tenant_id = ?`
  ).bind(newStatus, now, now, id, tenantId).run();
}

export async function listProspectsForFollowUp(
  db: D1Database,
  tenantId: string,
  daysWithoutContact = 3
): Promise<SocialFlowProspect[]> {
  await ensureSchema(db);
  const cutoff = new Date(Date.now() - daysWithoutContact * 24 * 60 * 60 * 1000).toISOString();
  const rows = await db.prepare(
    `SELECT * FROM socialflow_prospects
     WHERE tenant_id = ?
       AND status IN ('EMAIL_SENT','WA_SENT')
       AND outreach_count < 3
       AND (last_outreach_at IS NULL OR last_outreach_at < ?)
     ORDER BY last_outreach_at ASC LIMIT 50`
  ).bind(tenantId, cutoff).all<ProspectRow>();
  return (rows.results ?? []).map(rowToProspect);
}
