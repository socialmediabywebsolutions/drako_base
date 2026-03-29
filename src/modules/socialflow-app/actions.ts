'use server';

import { redirect } from 'next/navigation';
import { env } from '@/lib/cf';
import { randomUUID } from 'crypto';
import { runOrchestratorAnalysis } from '@/lib/orchestrator/engine';
import type { StrategicDossier } from '@/lib/orchestrator/types';

function isValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export async function submitStrategicForm(prevState: any, formData: FormData) {
  const headersList = await import('next/headers').then((mod) => mod.headers());
  const tenantId = headersList.get('x-drako-tenant-id') || headersList.get('x-tenant-id');

  if (!tenantId) {
    return { error: "Tenant Context Missing. Please refresh." };
  }

  const raw = {
    personal: {
      name: formData.get('personal_name'),
      email: formData.get('personal_email'),
      phone: formData.get('personal_phone'),
      country: formData.get('personal_country'),
      city: formData.get('personal_city'),
      address: formData.get('personal_address'),
    },
    business: {
      type: formData.get('business_type'),
      sector: formData.get('business_sector'),
      years: formData.get('business_years'),
      employees: formData.get('business_employees'),
      brands: formData.get('business_brands'),
      objective: formData.get('business_objective'),
    },
    digital: {
      web: formData.get('digital_web'),
      maps: formData.get('digital_maps'),
      instagram: formData.get('digital_instagram'),
      facebook: formData.get('digital_facebook'),
      linkedin: formData.get('digital_linkedin'),
      tiktok: formData.get('digital_tiktok'),
    },
    competition: {
      radiusKm: formData.get('competition_radius_km'),
      knownCompetitors: formData.get('competition_known_competitors'),
    },
    departments: formData.getAll('departments'),
    level: formData.get('maturity_level'),
  };

  if (!raw.personal.address || (raw.personal.address as string).length < 5) {
    return { error: "La Dirección Física es obligatoria y debe ser real." };
  }
  if (raw.digital.maps && !isValidUrl(raw.digital.maps as string)) {
    return { error: "La URL de Google Maps no es válida. Corrígela o déjala vacía." };
  }

  const bindings = env();
  const db = bindings?.DRACO_DB;
  if (!db) return { error: "Database Connection Failed" };

  try {
    const dossierId = randomUUID();
    const formDataJson = JSON.stringify(raw);

    await db.prepare(
      `INSERT INTO tenant_strategic_dossiers (id, tenant_id, version, status, form_data) 
       VALUES (?, ?, 1, 'draft', ?)`,
    ).bind(dossierId, tenantId, formDataJson).run();

    await db.prepare(
      `UPDATE tenants SET materialization_step = 1 WHERE id = ?`,
    ).bind(tenantId).run();
  } catch (err: any) {
    console.error("Dossier Save Error:", err);
    return { error: "Error guardando el formulario auditado. Inténtalo de nuevo." };
  }

  redirect('/socialflow/analysis');
}

export async function startAutoAnalysis() {
  const headersList = await import('next/headers').then((mod) => mod.headers());
  const tenantId = headersList.get('x-drako-tenant-id') || headersList.get('x-tenant-id');

  if (!tenantId) {
    return { error: "Tenant Context Missing." };
  }

  const bindings = env();
  const db = bindings?.DRACO_DB;
  if (!db) return { error: "Database Connection Failed" };

  try {
    const dossierRow = await db.prepare(
      `SELECT * FROM tenant_strategic_dossiers WHERE tenant_id = ? AND status = 'draft' ORDER BY created_at DESC LIMIT 1`,
    ).bind(tenantId).first<any>();

    if (!dossierRow) {
      return { error: "Dossier not found. Please complete Step 1." };
    }

    const dossier: StrategicDossier = {
      ...dossierRow,
      form_data: JSON.parse(dossierRow.form_data as string),
      analysis_data: dossierRow.analysis_data ? JSON.parse(dossierRow.analysis_data as string) : undefined,
      plan_data: dossierRow.plan_data ? JSON.parse(dossierRow.plan_data as string) : undefined,
    };

    const analysisResults = await runOrchestratorAnalysis(dossier);
    const analysisJson = JSON.stringify(analysisResults);
    await db.prepare(
      `UPDATE tenant_strategic_dossiers 
       SET analysis_data = ?, status = 'analyzed', updated_at = ? 
       WHERE id = ?`,
    ).bind(analysisJson, new Date().toISOString(), dossier.id).run();

    await db.prepare(
      `UPDATE tenants SET materialization_step = 2 WHERE id = ?`,
    ).bind(tenantId).run();

    return { success: true };
  } catch (err) {
    console.error("AutoAnalysis Error:", err);
    return { error: "Analysis Engine Logic Failed." };
  }
}

export async function generateBlueprint() {
  const headersList = await import('next/headers').then((mod) => mod.headers());
  const tenantId = headersList.get('x-drako-tenant-id') || headersList.get('x-tenant-id');

  if (!tenantId) return { error: "Context Missing" };

  const bindings = env();
  const db = bindings?.DRACO_DB;
  if (!db) return { error: "DB Error" };

  try {
    const dossierRow = await db.prepare(
      `SELECT * FROM tenant_strategic_dossiers WHERE tenant_id = ? AND status = 'analyzed' ORDER BY created_at DESC LIMIT 1`,
    ).bind(tenantId).first<any>();

    if (!dossierRow) return { error: "Analysis not complete" };

    const dossier: StrategicDossier = {
      ...dossierRow,
      form_data: JSON.parse(dossierRow.form_data as string),
      analysis_data: JSON.parse(dossierRow.analysis_data as string),
    };

    const { generateSaaSBlueprint } = await import('@/lib/orchestrator/planner');
    const blueprint = await generateSaaSBlueprint(dossier);

    await db.prepare(
      `UPDATE tenant_strategic_dossiers 
       SET plan_data = ?, status = 'analyzed', updated_at = ? 
       WHERE id = ?`,
    ).bind(JSON.stringify(blueprint), new Date().toISOString(), dossier.id).run();

    return { success: true };
  } catch (err) {
    console.error("Planner Error", err);
    return { error: "Blueprint Generation Failed" };
  }
}

export async function approveSaaSPlan() {
  const headersList = await import('next/headers').then((mod) => mod.headers());
  const tenantId = headersList.get('x-drako-tenant-id') || headersList.get('x-tenant-id');

  if (!tenantId) return { error: "Context Missing" };

  const bindings = env();
  const db = bindings?.DRACO_DB;
  if (!db) return { error: "DB Error" };

  try {
    const dossierRow = await db.prepare(
      `SELECT * FROM tenant_strategic_dossiers WHERE tenant_id = ? AND status = 'analyzed'`,
    ).bind(tenantId).first<any>();

    if (!dossierRow || !dossierRow.plan_data) {
      return { error: "No Blueprint found to approve." };
    }

    const dossier: StrategicDossier = {
      ...dossierRow,
      form_data: JSON.parse(dossierRow.form_data as string),
      analysis_data: JSON.parse(dossierRow.analysis_data as string),
      plan_data: JSON.parse(dossierRow.plan_data as string),
    };

    const { provisionSaaS } = await import('@/lib/orchestrator/provisioner');
    const provisioningResult = await provisionSaaS(tenantId, dossier);

    await db.prepare(
      `UPDATE tenant_strategic_dossiers SET status = 'active', updated_at = ? WHERE tenant_id = ?`,
    ).bind(new Date().toISOString(), tenantId).run();

    await db.prepare(
      `UPDATE tenants SET materialization_step = 4 WHERE id = ?`,
    ).bind(tenantId).run();

    const { success: _ignored, ...rest } = provisioningResult as { success?: boolean } & Record<string, unknown>;
    void _ignored;
    return { success: true, ...rest };
  } catch (err) {
    console.error("Deploy Error", err);
    return { error: "Deployment Failed" };
  }
}

export async function secureSaaS(instanceId: string) {
  console.log(`[SECURE_SAAS] Initiating Checkout for Instance: ${instanceId}`);
  return { success: true, message: "Redirigiendo a Pasarela..." };
}
