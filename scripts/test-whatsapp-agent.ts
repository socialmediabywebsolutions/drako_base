/**
 * Test script for WhatsApp Agent
 */
import { sendWhatsAppAlert } from '../connectors/whatsapp/agent';

async function testAgent() {
    console.log('--- WhatsApp Agent Test ---');

    try {
        // Test a common alert scenario
        const summary = '🚨 Alerta crítica en Drako: se detectó una caída en la base de datos principal. Revisar inmediatamente.';

        console.log('Sending alert...');
        await sendWhatsAppAlert(summary);

        console.log('Test execution finished.');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testAgent();
