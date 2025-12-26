import type { EmailClassification } from "@/lib/email-intake/types";
import type { SaasEmailMessage } from "@/lib/email-intake/types";
import type { SaasInventoryItem } from "@/lib/economy/types";
import type { EmailIntakeSuggestion } from "@/lib/email-intake/types";

const invoiceKeywords = ["factura", "invoice"];
const quoteKeywords = ["presupuesto", "quote", "oferta"];
const supplierKeywords = ["tarifa", "lista de precios", "proveedor", "distribuidor"];
const leadKeywords = ["quiero cita", "pedir hora", "appointment", "mechas", "corte de pelo", "reservar cita"];

const utilityKeywords = ["luz", "electricidad", "gas", "agua", "endesa", "iberdrola"];
const productKeywords = ["tinte", "producto", "champu", "shampoo", "oxidante", "mascarilla"];

export function classifyEmail(input: { subject?: string | null; body?: string | null; fromAddress: string }): EmailClassification {
  const subject = input.subject?.toLowerCase() ?? "";
  const body = input.body?.toLowerCase() ?? "";
  const from = input.fromAddress.toLowerCase();
  const text = `${subject} ${body}`;

  const hasInvoice = invoiceKeywords.some((keyword) => text.includes(keyword));
  const hasQuote = quoteKeywords.some((keyword) => text.includes(keyword));
  const hasSupplier = supplierKeywords.some((keyword) => text.includes(keyword)) || from.includes("proveedor") || from.includes("distribuidor");
  const hasLead = leadKeywords.some((keyword) => text.includes(keyword));

  if (hasInvoice) return "INVOICE";
  if (hasQuote) return "QUOTE";
  if (hasSupplier) return "SUPPLIER";
  if (hasLead) return "LEAD";
  return "OTHER";
}

export function detectInvoiceSubtype(input: { subject?: string | null; body?: string | null }): string | null {
  const subject = input.subject?.toLowerCase() ?? "";
  const body = input.body?.toLowerCase() ?? "";
  const text = `${subject} ${body}`;
  if (utilityKeywords.some((keyword) => text.includes(keyword))) return "INVOICE_UTILITY";
  if (productKeywords.some((keyword) => text.includes(keyword))) return "INVOICE_PRODUCTS";
  return null;
}

export function extractAmountAndCurrency(input: { subject?: string | null; body?: string | null }): {
  amount: number | null;
  currency: string | null;
} {
  const text = `${input.subject ?? ""} ${input.body ?? ""}`;
  const patterns = [
    /€\s?([0-9]+(?:[.,][0-9]+)?)/i,
    /([0-9]+(?:[.,][0-9]+)?)\s?€?/i,
    /([0-9]+(?:[.,][0-9]+)?)\s?eur/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const amount = Number(match[1].replace(",", "."));
      if (Number.isFinite(amount)) {
        return { amount, currency: "EUR" };
      }
    }
  }
  return { amount: null, currency: null };
}

export function extractSupplierName(input: { fromName?: string | null; fromAddress: string }): string | null {
  if (input.fromName?.trim()) return input.fromName.trim();
  const domain = input.fromAddress.split("@")[1] ?? "";
  if (!domain) return null;
  const name = domain.split(".")[0];
  return name || null;
}

export function analyzeSupplierOffer(
  email: SaasEmailMessage,
  inventoryItems: SaasInventoryItem[],
): EmailIntakeSuggestion[] {
  if (!["SUPPLIER", "QUOTE"].includes(email.classification)) return [];
  const text = `${email.subject ?? ""} ${email.body ?? ""}`.toLowerCase();
  const suggestions: EmailIntakeSuggestion[] = [];
  const amount = email.parsedAmount ?? null;
  if (!amount) return [];

  inventoryItems.forEach((item) => {
    if (!item.name) return;
    if (!text.includes(item.name.toLowerCase())) return;
    if (amount >= item.costPerUnit) return;
    const savingsEstimate = item.costPerUnit - amount;
    suggestions.push({
      type: "SUPPLIER",
      title: `Oferta mejor para ${item.name}`,
      description: `Oferta detectada por ${amount.toFixed(2)} € vs ${item.costPerUnit.toFixed(2)} € actuales.`,
      relatedInventoryItemId: item.id,
      savingsEstimate,
    });
  });

  return suggestions;
}
