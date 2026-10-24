import { randomUUID } from 'crypto';
import { env } from '@/lib/cf';
import type { AgentContext, AgentWorkLog } from './types';

export async function runSEOAgent(context: AgentContext): Promise<AgentWorkLog> {
    const { dossier } = context;
    const competitors = dossier.analysis_data.competitors_found || 0;
    const sector = dossier.form_data.business.sector;

    // 1. Generate Deterministic SEO Opportunities (Simulation)
    const keywords = [
        {
            keyword: `mejores empresas de ${sector}`,
            volume: '1.2k/mo',
            difficulty: 'Medium',
            opportunity: 'Crear comparativa "Top 10"'
        },
        {
            keyword: `${sector} precios 2026`,
            volume: '850/mo',
            difficulty: 'Low',
            opportunity: 'Landing page de precios transparente'
        },
        {
            keyword: `servicios de ${sector} baratos`,
            volume: '3.5k/mo',
            difficulty: 'High',
            opportunity: 'Post de blog: "Por qué lo barato sale caro"'
        },
        {
            keyword: `contratar ${sector} online`,
            volume: '500/mo',
            difficulty: 'Low',
            opportunity: 'Optimizar Home para transaccional'
        }
    ];

    // 2. Persist Work Log
    const logId = randomUUID();
    const workLog: AgentWorkLog = {
        id: logId,
        tenant_id: context.tenant_id,
        saas_id: context.saas_id,
        agent_name: 'SEO_OPTIMIZER',
        action_type: 'KEYWORD_RESEARCH',
        status: 'EXECUTED',
        output_json: {
            competitors_analyzed: competitors,
            top_opportunities: keywords
        },
        cost_eur: 25.00, // SEO audit value
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
