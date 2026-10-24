import { registerIntegrationDefinition } from "@/lib/integration-core/definitions";
import { registerIntegrationProvider } from "@/lib/integration-core/providers";
import type {
  IntegrationConnection,
  IntegrationProvider,
} from "@/lib/integration-core/types";
import {
  getWhatsappIdentityByPhone,
  recordWhatsappMessage,
  resolveWhatsappContext,
} from "@/lib/whatsapp/repository";

export const WHATSAPP_INTEGRATION_KEY = "whatsapp";

type WhatsappCredentials = {
  phoneNumber?: string;
  actorType?: string;
  actorId?: string;
  [key: string]: unknown;
};

class WhatsappIntegrationError extends Error {
  code: string;
  status: "CONNECTED" | "PENDING" | "INVALID" | "DISCONNECTED" | "NEEDS_REAUTH";

  constructor(
    code: string,
    message: string,
    status: "CONNECTED" | "PENDING" | "INVALID" | "DISCONNECTED" | "NEEDS_REAUTH" = "INVALID",
  ) {
    super(message);
    this.name = "WhatsappIntegrationError";
    this.code = code;
    this.status = status;
  }
}

function getWhatsappCredentials(connection: IntegrationConnection): WhatsappCredentials {
  return (connection.credentials ?? {}) as WhatsappCredentials;
}

function requireConfiguredPhoneNumber(connection: IntegrationConnection): string {
  const phoneNumber = typeof getWhatsappCredentials(connection).phoneNumber === "string"
    ? getWhatsappCredentials(connection).phoneNumber!.trim()
    : "";

  if (!phoneNumber) {
    throw new WhatsappIntegrationError(
      "WHATSAPP_CONNECTION_PHONE_REQUIRED",
      "WhatsApp connection phone number is required.",
      "INVALID",
    );
  }

  return phoneNumber;
}

async function resolveConnectedIdentity(connection: IntegrationConnection) {
  const phoneNumber = requireConfiguredPhoneNumber(connection);
  const whatsappCtx = await resolveWhatsappContext({
    tenantId: connection.tenantId,
    saasId: connection.saasId,
  });
  const identity = await getWhatsappIdentityByPhone(whatsappCtx, phoneNumber);

  if (!identity) {
    throw new WhatsappIntegrationError(
      "WHATSAPP_IDENTITY_NOT_FOUND",
      `WhatsApp identity ${phoneNumber} was not found for this SaaS.`,
      "INVALID",
    );
  }

  return { whatsappCtx, identity };
}

function requireMessagePayload(payload: Record<string, unknown> | null): {
  to: string;
  body: string;
} {
  const to = typeof payload?.to === "string" ? payload.to.trim() : "";
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";

  if (!to) {
    throw new WhatsappIntegrationError(
      "WHATSAPP_MESSAGE_TO_REQUIRED",
      "WhatsApp send_message requires a destination phone number.",
      "INVALID",
    );
  }

  if (!body) {
    throw new WhatsappIntegrationError(
      "WHATSAPP_MESSAGE_BODY_REQUIRED",
      "WhatsApp send_message requires a non-empty body.",
      "INVALID",
    );
  }

  return { to, body };
}

const whatsappProvider: IntegrationProvider = {
  async validate({ connection }) {
    try {
      const { identity } = await resolveConnectedIdentity(connection);

      return {
        ok: true,
        status: "CONNECTED",
        checkedAt: new Date().toISOString(),
        metadata: {
          ...(connection.metadata ?? {}),
          phoneNumber: identity.phoneNumber,
          actorType: identity.actorType,
          actorId: identity.actorId,
          preferredLanguage: identity.preferredLanguage,
        },
      };
    } catch (error) {
      const normalized = error instanceof WhatsappIntegrationError
        ? error
        : new WhatsappIntegrationError(
            "WHATSAPP_CONNECTION_INVALID",
            error instanceof Error ? error.message : "WhatsApp connection could not be validated.",
            "INVALID",
          );

      return {
        ok: false,
        status: normalized.status,
        checkedAt: new Date().toISOString(),
        error: {
          code: normalized.code,
          message: normalized.message,
        },
      };
    }
  },

  async executeOperation({ connection, operationKey, payload }) {
    if (operationKey !== "send_message") {
      return {
        ok: false,
        error: {
          code: "INTEGRATION_OPERATION_NOT_SUPPORTED",
          message: `${operationKey} is not supported by WhatsApp`,
        },
      };
    }

    try {
      const { whatsappCtx, identity } = await resolveConnectedIdentity(connection);
      const message = requireMessagePayload(payload);

      const recorded = await recordWhatsappMessage(whatsappCtx, {
        saasId: connection.saasId,
        phoneNumber: message.to,
        direction: "OUTBOUND",
        actorType: identity.actorType,
        actorId: identity.actorId,
        conversationId: null,
        body: message.body,
        intent: null,
        status: "SENT",
        providerMessageId: null,
        metadata: {
          integrationKey: WHATSAPP_INTEGRATION_KEY,
          operationKey,
          senderPhoneNumber: identity.phoneNumber,
        },
      });

      return {
        ok: true,
        result: {
          messageId: recorded.id,
          phoneNumber: recorded.phoneNumber,
          status: recorded.status,
        },
      };
    } catch (error) {
      const normalized = error instanceof WhatsappIntegrationError
        ? error
        : new WhatsappIntegrationError(
            "WHATSAPP_SEND_FAILED",
            error instanceof Error ? error.message : "WhatsApp send_message failed.",
            "INVALID",
          );

      return {
        ok: false,
        error: {
          code: normalized.code,
          message: normalized.message,
        },
      };
    }
  },
};

let whatsappRegistered = false;

export async function ensureWhatsappIntegrationAvailable(): Promise<void> {
  await registerIntegrationDefinition({
    integrationKey: WHATSAPP_INTEGRATION_KEY,
    displayName: "WhatsApp",
    provider: "whatsapp",
    category: "other",
    authMode: "custom",
    enabled: true,
    supportedOperations: ["send_message"],
  });

  if (!whatsappRegistered) {
    registerIntegrationProvider(WHATSAPP_INTEGRATION_KEY, whatsappProvider);
    whatsappRegistered = true;
  }
}
