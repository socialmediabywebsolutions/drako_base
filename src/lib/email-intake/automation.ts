import type { EmailIntakeSuggestion, EmailExpenseLinkResult } from "@/lib/email-intake/types";
import type { SaasEmailMessage } from "@/lib/email-intake/types";
import { analyzeSupplierOffer } from "@/lib/email-intake/classifier";
import type { EconomyContext } from "@/lib/economy/repository";
import { estimateMonthlyUsageForItem, listSaasInventoryItems, upsertSaasExpense } from "@/lib/economy/repository";
import type { EmailIntakeContext } from "@/lib/email-intake/repository";
import { ensureEmailConversation, updateEmailMessageStatus } from "@/lib/email-intake/repository";
import type { ConversationType, NotificationType, NotificationSeverity } from "@/lib/conversations/types";

function resolveExpenseType(subType: string | null): "UTILITIES" | "PRODUCTS" | "OTHER_FIXED" {
  if (subType === "INVOICE_UTILITY") return "UTILITIES";
  if (subType === "INVOICE_PRODUCTS") return "PRODUCTS";
  return "OTHER_FIXED";
}

function resolveExpensePeriod(subject?: string | null): "MONTHLY" | "ONE_OFF" {
  const text = subject?.toLowerCase() ?? "";
  if (text.includes("mensual") || text.includes("monthly")) return "MONTHLY";
  return "ONE_OFF";
}

function resolveConversationType(classification: SaasEmailMessage["classification"]): ConversationType {
  if (classification === "LEAD") return "LEAD";
  if (classification === "SUPPLIER" || classification === "QUOTE") return "SUPPLIER";
  return "OTHER";
}

function resolveConversationNotification(classification: SaasEmailMessage["classification"]): {
  type: NotificationType;
  severity: NotificationSeverity;
} {
  if (classification === "LEAD") return { type: "EMAIL_LEAD", severity: "INFO" };
  if (classification === "SUPPLIER" || classification === "QUOTE") return { type: "EMAIL_SUPPLIER_SAVINGS", severity: "INFO" };
  return { type: "CONVERSATION_NEW_MESSAGE", severity: "INFO" };
}

export async function applyEmailAutomations(
  emailCtx: EmailIntakeContext,
  email: SaasEmailMessage,
  economyCtx: EconomyContext,
): Promise<EmailExpenseLinkResult & { suggestions: EmailIntakeSuggestion[] }> {
  try {
    await ensureEmailConversation(emailCtx, email, {
      conversationType: resolveConversationType(email.classification),
      notification: {
        ...resolveConversationNotification(email.classification),
        title: email.subject ?? "Nuevo email en conversaciones",
        body: email.snippet ?? "Nuevo email recibido",
      },
    });
  } catch (error) {
    console.error("EMAIL_INTAKE_CONVERSATION_SYNC_FAILED", error);
  }

  if (email.classification === "INVOICE") {
    if (email.linkedExpenseId || email.status === "CONVERTED_TO_EXPENSE") {
      return {
        message: "Factura ya vinculada a un gasto",
        suggestions: [],
      };
    }
    const createdExpense = await upsertSaasExpense(economyCtx, {
      saasId: email.saasId,
      type: resolveExpenseType(email.subType),
      label: email.subject ?? email.parsedSupplierName ?? "Factura detectada",
      amount: email.parsedAmount ?? 0,
      currency: email.parsedCurrency ?? "EUR",
      period: resolveExpensePeriod(email.subject),
      fromDate: email.receivedAt,
      toDate: null,
      source: "INVOICE_EMAIL",
      metadata: { emailId: email.id },
    });
    await updateEmailMessageStatus(emailCtx, email.id, "CONVERTED_TO_EXPENSE", {
      linkedExpenseId: createdExpense.id,
    });
    return {
      message: "Factura convertida en gasto",
      createdExpense: { id: createdExpense.id },
      suggestions: [
        {
          type: "EXPENSE",
          title: "Gasto registrado automaticamente",
          description: `Se creo un gasto ${createdExpense.type} en Economy.`,
          relatedExpenseId: createdExpense.id,
        },
      ],
    };
  }

  if (email.classification === "SUPPLIER" || email.classification === "QUOTE") {
    const inventoryItems = await listSaasInventoryItems(economyCtx);
    const suggestions = analyzeSupplierOffer(email, inventoryItems);
    const enriched = await Promise.all(
      suggestions.map(async (suggestion) => {
        if (!suggestion.relatedInventoryItemId || !suggestion.savingsEstimate) return suggestion;
        const monthlyUsage = await estimateMonthlyUsageForItem(economyCtx, suggestion.relatedInventoryItemId);
        const inventoryItem = inventoryItems.find((item) => item.id === suggestion.relatedInventoryItemId);
        const currentUnitCost = inventoryItem?.costPerUnit;
        const offeredUnitCost =
          typeof currentUnitCost === "number" ? currentUnitCost - suggestion.savingsEstimate : undefined;
        const monthlySavingsEstimate = monthlyUsage > 0 ? suggestion.savingsEstimate * monthlyUsage : 0;
        const usageLabel = monthlyUsage > 0 ? `Usas ~${monthlyUsage.toFixed(1)} unidades/mes.` : "Sin datos suficientes de uso.";
        const savingsLabel =
          monthlyUsage > 0
            ? `Cambiar a esta oferta ahorraria ~${monthlySavingsEstimate.toFixed(1)} €/mes.`
            : "No hay datos suficientes para estimar el ahorro mensual.";
        const costLabel =
          typeof currentUnitCost === "number" && typeof offeredUnitCost === "number"
            ? `Precio actual: ${currentUnitCost.toFixed(2)} €/u · Oferta: ${offeredUnitCost.toFixed(2)} €/u.`
            : "";
        return {
          ...suggestion,
          title: `Ahorro potencial en ${inventoryItem?.name ?? "producto"}`,
          description: [usageLabel, savingsLabel, costLabel].filter(Boolean).join(" "),
          currentUnitCost,
          offeredUnitCost,
          monthlyUsageEstimate: monthlyUsage,
          monthlySavingsEstimate,
          estimatedMonthlyUsage: monthlyUsage,
          estimatedMonthlySaving: monthlySavingsEstimate,
        };
      }),
    );
    return { message: "Oferta de proveedor analizada", suggestions: enriched };
  }

  if (email.classification === "LEAD") {
    return {
      message: "Lead detectado",
      suggestions: [
        {
          type: "LEAD",
          title: "Lead potencial",
          description: "Conviene mover este email a pipeline de clientes/Bookings.",
        },
      ],
    };
  }

  return { message: "Sin automatizaciones", suggestions: [] };
}
