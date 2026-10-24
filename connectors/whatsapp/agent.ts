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

export type WhatsAppSendResult = {
    success: boolean;
    messageId?: string;
    error?: string;
    retryCount: number;
};

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

function validateWhatsAppConfig(): { token: string; phoneNumberId: string; recipientPhone: string } {
    const token = process.env.WHATSAPP_TOKEN?.trim();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
    const recipientPhone = process.env.RECIPIENT_PHONE?.trim();

    if (!token) {
        throw new Error('WHATSAPP_TOKEN environment variable is required');
    }
    if (!phoneNumberId) {
        throw new Error('WHATSAPP_PHONE_NUMBER_ID environment variable is required');
    }
    if (!recipientPhone) {
        throw new Error('RECIPIENT_PHONE environment variable is required');
    }

    return { token, phoneNumberId, recipientPhone };
}

async function sendWhatsAppWithRetry(
    url: string,
    payload: Record<string, unknown>,
    token: string,
    retryCount: number = 0,
): Promise<WhatsAppSendResult> {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const data = await response.json() as any;

        if (!response.ok) {
            const errorMessage = data.error?.message || response.statusText;
            const error = new Error(`WhatsApp API Error: ${errorMessage}`);

            if (retryCount < MAX_RETRIES && (response.status === 429 || response.status >= 500)) {
                const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
                logToWhatsAppAgent('INFO', `RETRYING (attempt ${retryCount + 1}/${MAX_RETRIES}) after ${backoffMs}ms: ${errorMessage}`);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                return sendWhatsAppWithRetry(url, payload, token, retryCount + 1);
            }

            logToWhatsAppAgent('ERROR', `Failed to send alert after ${retryCount} retries: ${errorMessage}`);
            throw error;
        }

        const messageId = data.messages?.[0]?.id;
        logToWhatsAppAgent('INFO', `Alert sent successfully. Message ID: ${messageId}`);
        return {
            success: true,
            messageId,
            retryCount,
        };
    } catch (error: any) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (retryCount < MAX_RETRIES) {
            const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
            logToWhatsAppAgent('INFO', `RETRYING (attempt ${retryCount + 1}/${MAX_RETRIES}) after ${backoffMs}ms: ${errorMessage}`);
            await new Promise(resolve => setTimeout(resolve, backoffMs));
            return sendWhatsAppWithRetry(url, payload, token, retryCount + 1);
        }

        logToWhatsAppAgent('ERROR', `Failed to send alert after ${retryCount} retries: ${errorMessage}`);
        throw error;
    }
}

/**
 * Sends a WhatsApp alert using the Cloud API with retry logic.
 * @param summary The message content to send.
 * @returns Result object with success status and message ID
 * @throws Error if all retry attempts fail or config is missing
 */
export async function sendWhatsAppAlert(summary: string): Promise<WhatsAppSendResult> {
    const { token, phoneNumberId, recipientPhone } = validateWhatsAppConfig();

    const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

    const payload = {
        messaging_product: 'whatsapp',
        to: recipientPhone,
        type: 'text',
        text: {
            body: summary,
        },
    };

    return sendWhatsAppWithRetry(url, payload, token);
}
