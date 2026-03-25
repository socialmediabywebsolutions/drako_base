import type { AutomationHandler } from "@/lib/automation-core/types";

const automationHandlers = new Map<string, AutomationHandler>();

export function registerAutomationHandler(automationKey: string, handler: AutomationHandler): void {
  automationHandlers.set(automationKey, handler);
}

export function getAutomationHandler(automationKey: string): AutomationHandler | null {
  return automationHandlers.get(automationKey) ?? null;
}
