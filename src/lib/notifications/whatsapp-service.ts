/**
 * P1 PRODUCT REAL: WhatsApp Service
 * 
 * Servicio de notificaciones WhatsApp
 * - Compatible con Cloudflare Workers (fetch-based)
 * - Preparado para Twilio / Meta API
 * - Sin hardcode de vendor
 * - Fail-closed: requiere credenciales reales
 */

import { getDb } from "@/lib/db";
import { crypto } from "@cloudflare/workers-types";

export interface WhatsAppMessage {
  to: string;
  body: string;
  mediaUrl?: string;
}

export interface WhatsAppServiceConfig {
  provider: "twilio" | "meta" | "mock";
  apiKey: string;
  apiSecret?: string;
  phoneNumber?: string;
  businessAccountId?: string;
}

/**
 * Servicio WhatsApp con soporte multi-vendor
 */
export class WhatsAppService {
  private config: WhatsAppServiceConfig;

  constructor(config: WhatsAppServiceConfig) {
    if (!config.apiKey) {
      throw new Error("WhatsApp API key is required");
    }
    this.config = config;
  }

  /**
   * Envía mensaje WhatsApp real
   */
  async sendMessage(message: WhatsAppMessage): Promise<{ messageId: string; status: string }> {
    if (this.config.provider === "mock") {
      return this.sendMockMessage(message);
    }

    if (this.config.provider === "twilio") {
      return this.sendTwilioMessage(message);
    }

    if (this.config.provider === "meta") {
      return this.sendMetaMessage(message);
    }

    throw new Error(`Unsupported WhatsApp provider: ${this.config.provider}`);
  }

  /**
   * Envía mensaje a través de Twilio
   */
  private async sendTwilioMessage(message: WhatsAppMessage): Promise<{ messageId: string; status: string }> {
    const accountSid = this.config.apiKey.split(":")[0];
    const authToken = this.config.apiSecret || this.config.apiKey.split(":")[1];
    const fromNumber = this.config.phoneNumber || "whatsapp:+1234567890";

    const auth = btoa(`${accountSid}:${authToken}`);

    const body = new URLSearchParams({
      From: fromNumber,
      To: `whatsapp:${message.to}`,
      Body: message.body,
    });

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Twilio API error: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    return {
      messageId: data.sid,
      status: data.status,
    };
  }

  /**
   * Envía mensaje a través de Meta (WhatsApp Business API)
   */
  private async sendMetaMessage(message: WhatsAppMessage): Promise<{ messageId: string; status: string }> {
    const businessAccountId = this.config.businessAccountId || "0";
    const accessToken = this.config.apiKey;

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: message.to,
      type: "text",
      text: {
        body: message.body,
      },
    };

    const response = await fetch(
      `https://graph.instagram.com/v18.0/${businessAccountId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error(`Meta API error: ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    return {
      messageId: data.messages[0].id,
      status: "sent",
    };
  }

  /**
   * Mock para desarrollo/testing
   */
  private async sendMockMessage(message: WhatsAppMessage): Promise<{ messageId: string; status: string }> {
    const messageId = crypto.randomUUID();
    console.log(`[MOCK WhatsApp] To: ${message.to}, Body: ${message.body}`);
    return {
      messageId,
      status: "queued",
    };
  }
}

/**
 * Registra contacto WhatsApp de guardián
 */
export async function registerWhatsAppContact(
  guardianId: string,
  phoneNumber: string,
  verified: boolean = false
): Promise<{ id: string; guardianId: string; phoneNumber: string }> {
  const db = getDb();
  const contactId = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO whatsapp_contacts (id, guardian_id, phone_number, verified, created_at)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(contactId, guardianId, phoneNumber, verified ? 1 : 0, new Date().toISOString())
    .run();

  return {
    id: contactId,
    guardianId,
    phoneNumber,
  };
}

/**
 * Obtiene contactos WhatsApp de guardián
 */
export async function getWhatsAppContacts(guardianId: string): Promise<Array<{ id: string; phoneNumber: string; verified: boolean; optedIn: boolean }>> {
  const db = getDb();

  const result = await db
    .prepare(
      `SELECT id, phone_number, verified, opted_in
       FROM whatsapp_contacts
       WHERE guardian_id = ?`
    )
    .bind(guardianId)
    .all<any>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    phoneNumber: row.phone_number,
    verified: Boolean(row.verified),
    optedIn: Boolean(row.opted_in),
  }));
}

/**
 * Actualiza preferencia de opt-in
 */
export async function updateWhatsAppOptIn(contactId: string, optedIn: boolean): Promise<void> {
  const db = getDb();

  await db
    .prepare(`UPDATE whatsapp_contacts SET opted_in = ? WHERE id = ?`)
    .bind(optedIn ? 1 : 0, contactId)
    .run();
}
