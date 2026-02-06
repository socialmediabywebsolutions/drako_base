import { randomUUID } from 'crypto';
import { env } from '@/lib/cf';
import type { AgentContext, AgentWorkLog } from './types';

export async function runMarketingAgent(context: AgentContext): Promise<AgentWorkLog> {
    const { dossier } = context;
    const business = dossier.form_data.business;

    // 1. Generate Deterministic Content (Simulation for v1)
    // In v2, this would call an LLM with a prompt.
    const posts = [
        {
            id: 1,
            type: 'instagram_post',
            caption: `🚀 Transformando el sector ${business.sector} con innovación. En ${business.brands}, llevamos ${business.years} años definiendo el futuro. #Innovation #${business.sector.replace(/\s/g, '')}`,
            image_prompt: `High-end photography of ${business.sector} environment, professional lighting, minimal style`,
            suggested_time: '18:00 CET'
        },
        {
            id: 2,
            type: 'instagram_story',
            caption: `💡 ¿Sabías que...? Nuestro objetivo es ${business.objective}. Únete al cambio.`,
            image_prompt: `Abstract geometric background with text overlay area, brand colors`,
            suggested_time: '10:00 CET'
        },
        {
            id: 3,
            type: 'linkedin_post',
            caption: `Orgullosos de nuestro equipo. ${business.employees} profesionales dedicados a la excelencia en ${business.sector}.`,
            image_prompt: `Corporate team working in modern office, depth of field, bright atmosphere`,
            suggested_time: '09:00 CET'
        }
    ];

    // 2. Persist Work Log
    const logId = randomUUID();
    const workLog: AgentWorkLog = {
        id: logId,
        tenant_id: context.tenant_id,
        saas_id: context.saas_id,
        agent_name: 'MARKETING_BOT',
        action_type: 'GENERATE_POSTS',
        status: 'EXECUTED', // Auto-executed for now
        output_json: posts,
        cost_eur: 15.00, // Estimated market value of 3 posts
        created_at: new Date().toISOString()
    };

    const bindings = env();
    if (bindings?.DRACO_DB) {
        await bindings.DRACO_DB.prepare(
            `INSERT INTO agent_work_logs (id, tenant_id, saas_id, agent_name, action_type, status, output_json, cost_eur, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            workLog.id, workLog.tenant_id, workLog.saas_id, workLog.agent_name,
            workLog.action_type, workLog.status, JSON.stringify(workLog.output_json),
            workLog.cost_eur, workLog.created_at
        ).run();
    }

    return workLog;
}
