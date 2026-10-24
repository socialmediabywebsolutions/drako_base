/**
 * conversation-router/index.ts
 *
 * Minimal reusable conversation router for the Drako ecosystem.
 * Routes inbound messages to the appropriate domain handler based on
 * channel, sender, tenant, and saasTarget.
 *
 * Design principles:
 * - No complex intelligence or memory (handlers provide that)
 * - Extensible: any SaaS can register its own handler
 * - Fallback to "campamento-base" for unregistered targets
 * - Clean error handling and logging
 *
 * IMPORTANT SERVERLESS LIMITATION:
 * The handler registry uses module-level state (Map) which is NOT guaranteed
 * to persist across requests in serverless environments (Cloudflare Pages,
 * Vercel Functions, etc.). Handlers must be re-registered on cold starts.
 * 
 * The /api/conversation-router endpoint handles this via bootstrapHandlers()
 * but consumers should be aware that registration is not persistent.
 *
 * Usage:
 *   import { registerHandler, routeConversation } from "@/lib/conversation-router";
 *
 * Adding a new SaaS handler:
 *   registerHandler("mentoria-acme", mentoriaHandler);
 *   registerHandler("socialflow-xyz", socialflowHandler);
 */
import type { Channel, ConversationHandler, ConversationRoute, RouteResult } from "./types";

export type { Channel, ConversationHandler, ConversationRoute, RouteResult };

const FALLBACK_TARGET = "campamento-base";

const _handlers = new Map<string, ConversationHandler>();

/**
 * Register a handler for a specific saasTarget.
 * Call this once at application startup (e.g. in a Next.js initializer or worker bootstrap).
 */
export function registerHandler(target: string, handler: ConversationHandler): void {
  _handlers.set(target, handler);
}

/**
 * Returns true if a handler is already registered for the given target.
 * Useful for lazy registration guards.
 */
export function hasHandler(target: string): boolean {
  return _handlers.has(target);
}

/**
 * List all currently registered targets.
 * Useful for diagnostics and observability endpoints.
 */
export function listRegisteredTargets(): string[] {
  return Array.from(_handlers.keys());
}

/**
 * Route an inbound conversation turn to the correct handler.
 *
 * Resolution order:
 *   1. Exact match on route.saasTarget
 *   2. Fallback to "campamento-base" handler
 *   3. If neither exists: return handled=false with NO_HANDLER_REGISTERED
 */
export async function routeConversation(route: ConversationRoute): Promise<RouteResult> {
  const handler = _handlers.get(route.saasTarget) ?? _handlers.get(FALLBACK_TARGET);

  if (!handler) {
    return {
      handled: false,
      handler: "none",
      reply: null,
      error: "NO_HANDLER_REGISTERED",
    };
  }

  try {
    return await handler(route);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[conversation-router] handler error", { target: route.saasTarget, error: message });
    return {
      handled: false,
      handler: route.saasTarget,
      reply: null,
      error: message,
    };
  }
}
