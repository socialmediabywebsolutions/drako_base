import { test, expect } from '@playwright/test';

/**
 * Test Suite: Templates Marketplace
 * Valida funcionalidad completa del marketplace de templates
 */

test.describe('Templates Marketplace API', () => {
    const BASE_URL = 'http://localhost:3000';
    const TENANT_ID = 'demo';

    test('GET /api/templates - Lista templates disponibles', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/templates?featured=true`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.templates).toBeDefined();
        expect(Array.isArray(data.templates)).toBe(true);
        expect(data.templates.length).toBeGreaterThan(0);

        // Verificar estructura de template
        const template = data.templates[0];
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('slug');
        expect(template).toHaveProperty('vertical');
        expect(template).toHaveProperty('tier');
        expect(template).toHaveProperty('installations');
        expect(template).toHaveProperty('rating');
        expect(template).toHaveProperty('isOfficial');

        console.log(`✅ Found ${data.templates.length} templates`);
    });

    test('GET /api/templates/saas-b2b-starter - Obtiene template específico', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/templates/saas-b2b-starter`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.template).toBeDefined();
        expect(data.template.slug).toBe('saas-b2b-starter');
        expect(data.template.name).toBe('SaaS B2B Starter');
        expect(data.template.vertical).toBe('SAAS');

        // Verificar entitlements
        expect(data.template.defaultEntitlements).toBeDefined();
        expect(data.template.defaultEntitlements.packs).toContain('crm');

        // Verificar pricing tiers
        expect(data.template.stripePricingTiers).toBeDefined();
        expect(data.template.stripePricingTiers.length).toBeGreaterThan(0);

        console.log(`✅ Template details loaded: ${data.template.name}`);
    });

    test('POST /api/templates/deploy - Despliega template', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/templates/deploy`, {
            headers: {
                'Content-Type': 'application/json',
                'x-drako-tenant-id': TENANT_ID,
            },
            data: {
                templateId: 'tpl_saas_b2b_starter',
                customization: {
                    name: 'Test CRM',
                    slug: 'test-crm-playwright',
                    branding: {
                        primaryColor: '#3B82F6',
                        secondaryColor: '#10B981',
                    },
                },
            },
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.saas).toBeDefined();
        expect(data.saas.saasId).toBeDefined();
        expect(data.saas.name).toBe('Test CRM');
        expect(data.saas.slug).toBe('test-crm-playwright');
        expect(data.saas.status).toBe('active');
        expect(data.saas.entitlementsApplied).toBe(true);

        console.log(`✅ SaaS deployed: ${data.saas.saasId}`);
    });
});

/**
 * Test Suite: Health Score System
 */
test.describe('Health Score API', () => {
    const BASE_URL = 'http://localhost:3000';
    const TENANT_ID = 'demo';
    let testSaasId: string;

    test.beforeAll(async () => {
        // Asumimos que hay un SaaS demo disponible
        testSaasId = 'demo-saas';
    });

    test('POST /api/saas/[id]/health - Calcula health score', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/saas/${testSaasId}/health`, {
            headers: {
                'x-drako-tenant-id': TENANT_ID,
            },
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.overallScore).toBeDefined();
        expect(data.overallScore).toBeGreaterThanOrEqual(0);
        expect(data.overallScore).toBeLessThanOrEqual(100);

        expect(data.status).toMatch(/healthy|warning|critical/);
        expect(data.factors).toBeDefined();
        expect(data.factors.length).toBe(5);

        // Verificar factores
        const factorNames = data.factors.map((f: any) => f.name);
        expect(factorNames).toContain('Revenue Growth');
        expect(factorNames).toContain('Customer Retention');
        expect(factorNames).toContain('Technical Health');
        expect(factorNames).toContain('Feature Utilization');
        expect(factorNames).toContain('Support Quality');

        console.log(`✅ Health score: ${data.overallScore}/100 (${data.status})`);
    });

    test('GET /api/saas/[id]/health - Obtiene health score cacheado', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/saas/${testSaasId}/health`, {
            headers: {
                'x-drako-tenant-id': TENANT_ID,
            },
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.overallScore).toBeDefined();
        expect(data.calculatedAt).toBeDefined();

        console.log(`✅ Cached health score retrieved`);
    });
});

/**
 * Test Suite: Analytics Dashboard
 */
test.describe('Analytics API', () => {
    const BASE_URL = 'http://localhost:3000';
    const TENANT_ID = 'demo';

    test('GET /api/analytics/holding - Obtiene métricas consolidadas', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/analytics/holding`, {
            headers: {
                'x-drako-tenant-id': TENANT_ID,
            },
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.metrics).toBeDefined();

        // Financial metrics
        expect(data.metrics.financial).toBeDefined();
        expect(data.metrics.financial.mrr).toBeGreaterThanOrEqual(0);
        expect(data.metrics.financial.arr).toBeGreaterThanOrEqual(0);

        // Operational metrics
        expect(data.metrics.operational).toBeDefined();
        expect(data.metrics.operational.activeSaas).toBeGreaterThanOrEqual(0);
        expect(data.metrics.operational.totalCustomers).toBeGreaterThanOrEqual(0);

        // SaaS breakdown
        expect(data.metrics.saasList).toBeDefined();
        expect(Array.isArray(data.metrics.saasList)).toBe(true);

        console.log(`✅ Holding metrics: MRR=$${data.metrics.financial.mrr}, ${data.metrics.operational.activeSaas} SaaS`);
    });

    test('GET /api/analytics/holding?history=true - Incluye histórico', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/analytics/holding?history=true&days=7`, {
            headers: {
                'x-drako-tenant-id': TENANT_ID,
            },
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.history).toBeDefined();
        expect(Array.isArray(data.history)).toBe(true);

        console.log(`✅ Historical data: ${data.history.length} snapshots`);
    });
});

/**
 * Test Suite: AI Blueprint v2
 */
test.describe('AI Blueprint v2 API', () => {
    const BASE_URL = 'http://localhost:3000';
    const TENANT_ID = 'demo';

    test('POST /api/campamento-base/saas-factory/chat - Genera blueprint', async ({ request }) => {
        const response = await request.post(`${BASE_URL}/api/campamento-base/saas-factory/chat`, {
            headers: {
                'Content-Type': 'application/json',
                'x-drako-tenant-id': TENANT_ID,
            },
            data: {
                message: 'Quiero un CRM para inmobiliarias con IA',
            },
        });

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.reply).toBeDefined();
        expect(data.blueprint).toBeDefined();

        // Verificar respuesta v2 extendida
        expect(data.v2).toBeDefined();
        expect(data.v2.fullAnalysis).toBeDefined();
        expect(data.v2.fullAnalysis.understanding).toBeDefined();
        expect(data.v2.fullAnalysis.pricing).toBeDefined();
        expect(data.v2.fullAnalysis.roadmap).toBeDefined();
        expect(data.v2.fullAnalysis.marketingCopy).toBeDefined();

        console.log(`✅ AI Blueprint generated with roadmap`);
        console.log(`   Understanding: ${data.v2.fullAnalysis.understanding.substring(0, 50)}...`);
        console.log(`   Pricing: $${data.v2.fullAnalysis.pricing.monthly}/mo`);
    });
});

/**
 * Test Suite: Stripe Wizard
 */
test.describe('Stripe Wizard API', () => {
    const BASE_URL = 'http://localhost:3000';
    const TENANT_ID = 'demo';

    test('GET /api/stripe/wizard/templates - Lista templates Stripe', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/stripe/wizard/templates`);

        expect(response.status()).toBe(200);

        const data = await response.json();
        expect(data.templates).toBeDefined();
        expect(Array.isArray(data.templates)).toBe(true);

        console.log(`✅ Stripe templates available: ${data.templates.length}`);
    });
});
