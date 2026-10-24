import type { AgentResponse, AgentTask } from "@/lib/drako/agent-core";
import type { Insight } from "@/lib/drako/insights";
import type { UserContext } from "@/lib/drako/memory";

export type ActivationEvent = {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  channel: string;
  status: "activated" | "blocked";
  task: AgentTask;
  response: AgentResponse;
  insights: Insight[];
  nextActions: string[];
  createdAt: string;
  metadata: Record<string, unknown>;
};

export function createActivationEvent(input: {
  id?: string;
  context: UserContext;
  type?: string;
  channel: string;
  task: AgentTask;
  response: AgentResponse;
  insights?: Insight[];
  nextActions?: string[];
  status?: ActivationEvent["status"];
  metadata?: Record<string, unknown>;
  createdAt?: string;
}): ActivationEvent {
  return {
    id: input.id ?? crypto.randomUUID(),
    tenantId: input.context.tenantId,
    userId: input.context.userId,
    type: input.type ?? `activation.${input.channel}`,
    channel: input.channel,
    status: input.status ?? "activated",
    task: input.task,
    response: input.response,
    insights: [...(input.insights ?? [])],
    nextActions: [...(input.nextActions ?? [])],
    createdAt: input.createdAt ?? new Date().toISOString(),
    metadata: input.metadata ?? {},
  };
}
