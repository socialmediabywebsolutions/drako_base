import { env } from "@/lib/cf";

export type WhatsAppSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  retryCount?: number;
};

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

function validatePhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== "string") return false;
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 10 && cleaned.length <= 15;
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendViaWhatsApp(
  phoneNumber: string,
  message: string,
  retryCount: number = 0
): Promise<WhatsAppSendResult> {
  const bindings = env();
  const twilioAccountSid = 
    (typeof process !== "undefined" ? process.env?.TWILIO_ACCOUNT_SID : undefined) ||
    ((bindings as unknown as Record<string, string | undefined>)?.TWILIO_ACCOUNT_SID);
  const twilioAuthToken =
    (typeof process !== "undefined" ? process.env?.TWILIO_AUTH_TOKEN : undefined) ||
    ((bindings as unknown as Record<string, string | undefined>)?.TWILIO_AUTH_TOKEN);
  const twilioPhoneNumber =
    (typeof process !== "undefined" ? process.env?.TWILIO_WHATSAPP_FROM : undefined) ||
    ((bindings as unknown as Record<string, string | undefined>)?.TWILIO_WHATSAPP_FROM);

  if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
    return {
      success: false,
      error: "WHATSAPP_CREDENTIALS_MISSING",
    };
  }

  if (!validatePhoneNumber(phoneNumber)) {
    return {
      success: false,
      error: "INVALID_PHONE_NUMBER",
    };
  }

  if (!message || message.trim().length === 0) {
    return {
      success: false,
      error: "EMPTY_MESSAGE",
    };
  }

  try {
    const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64");
    const formData = new URLSearchParams();
    formData.append("From", `whatsapp:${twilioPhoneNumber}`);
    formData.append("To", `whatsapp:${phoneNumber}`);
    formData.append("Body", message);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as any)?.message || `HTTP ${response.status}`;
      
      if (retryCount < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * (retryCount + 1));
        return sendViaWhatsApp(phoneNumber, message, retryCount + 1);
      }

      return {
        success: false,
        error: errorMessage,
        retryCount,
      };
    }

    const data = (await response.json()) as any;
    const messageId = data?.sid;

    if (!messageId) {
      return {
        success: false,
        error: "NO_MESSAGE_ID_RETURNED",
        retryCount,
      };
    }

    return {
      success: true,
      messageId,
      retryCount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (retryCount < MAX_RETRIES) {
      await delay(RETRY_DELAY_MS * (retryCount + 1));
      return sendViaWhatsApp(phoneNumber, message, retryCount + 1);
    }

    return {
      success: false,
      error: errorMessage,
      retryCount,
    };
  }
}

export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<WhatsAppSendResult> {
  return sendViaWhatsApp(phoneNumber, message, 0);
}
