/**
 * WhatsApp Agent v1
 * Handles communication with WhatsApp Business Cloud API.
 */

import fs from 'fs';
import path from 'path';

// Standardized log path
const LOG_FILE = path.join(process.cwd(), 'logs', 'whatsapp-agent.log');

/**
 * Ensures the log directory and file exist.
 */
function ensureLogFile() {
    const logDir = path.dirname(LOG_FILE);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    if (!fs.existsSync(LOG_FILE)) {
        fs.writeFileSync(LOG_FILE, '');
    }
}

/**
 * Appends a message to the log file.
 */
function logToWhatsAppAgent(level: 'INFO' | 'ERROR', message: string) {
    ensureLogFile();
    const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, logEntry);
    console.log(`[WhatsAppAgent] ${level}: ${message}`);
}

/**
 * Sends a WhatsApp alert using the Cloud API.
 * @param summary The message content to send.
 */
export async function sendWhatsAppAlert(summary: string): Promise<void> {
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
    const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const RECIPIENT_PHONE = process.env.RECIPIENT_PHONE;

    // Dry-run mode detection
    const isDryRun = !WHATSAPP_TOKEN || !WHATSAPP_PHONE_NUMBER_ID || !RECIPIENT_PHONE;

    if (isDryRun) {
        logToWhatsAppAgent('INFO', `DRY-RUN MODE: Missing environment variables. Alert summary: "${summary}"`);
        return;
    }

    const url = `https://graph.facebook.com/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to: RECIPIENT_PHONE,
        type: 'text',
        text: {
            body: summary,
        },
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json() as any;

        if (!response.ok) {
            const errorMessage = data.error?.message || response.statusText;
            throw new Error(`WhatsApp API Error: ${errorMessage}`);
        }

        logToWhatsAppAgent('INFO', `Alert sent successfully to ${RECIPIENT_PHONE}. Message ID: ${data.messages?.[0]?.id}`);
    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logToWhatsAppAgent('ERROR', `Failed to send alert: ${errorMessage}`);
        throw error;
    }
}
