import type { UserContext } from "@/lib/drako/memory";

export type AgentTask<TInput = Record<string, unknown>, TContext extends UserContext = UserContext> = {
  id: string;
  type: string;
  kind: string;
  channel: string;
  objective: string;
  context: TContext;
  input: TInput;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AgentResponse<TOutput = Record<string, unknown>> = {
  taskId: string;
  status: "completed" | "failed";
  reply: string;
  output: TOutput;
  recommendations: string[];
  usage?: {
    tokens?: number;
    durationMs?: number;
  };
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type AgentHandler<
  TInput = Record<string, unknown>,
  TOutput = Record<string, unknown>,
  TContext extends UserContext = UserContext,
> = (task: AgentTask<TInput, TContext>) => Promise<AgentResponse<TOutput>>;

export const agentRegistry = new Map<string, AgentHandler<any, any, any>>();

export function createAgentTask<TInput, TContext extends UserContext>(input: {
  id?: string;
  kind: string;
  channel: string;
  objective: string;
  context: TContext;
  input: TInput;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}): AgentTask<TInput, TContext> {
  return {
    id: input.id ?? crypto.randomUUID(),
    type: input.kind,
    kind: input.kind,
    channel: input.channel,
    objective: input.objective,
    context: input.context,
    input: input.input,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function createAgentResponse<TOutput, TTaskInput, TContext extends UserContext>(input: {
  task: AgentTask<TTaskInput, TContext>;
  status?: AgentResponse<TOutput>["status"];
  reply: string;
  output: TOutput;
  recommendations?: string[];
  usage?: AgentResponse<TOutput>["usage"];
  metadata?: Record<string, unknown>;
  createdAt?: string;
}): AgentResponse<TOutput> {
  return {
    taskId: input.task.id,
    status: input.status ?? "completed",
    reply: input.reply,
    output: input.output,
    recommendations: [...(input.recommendations ?? [])],
    usage: input.usage,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function registerAgent(type: string, handler: AgentHandler<any, any, any>): void {
  if (!type.trim()) {
    throw new Error("AGENT_TYPE_REQUIRED");
  }
  agentRegistry.set(type, handler);
}

export async function executeAgent<TInput, TOutput, TContext extends UserContext = UserContext>(
  task: AgentTask<TInput, TContext>,
): Promise<AgentResponse<TOutput>> {
  const handler = agentRegistry.get(task.type);
  if (!handler) {
    console.error("DRAKO_AGENT_NOT_REGISTERED", { type: task.type, taskId: task.id });
    throw new Error(`AGENT_NOT_REGISTERED:${task.type}`);
  }

  console.info("DRAKO_AGENT_EXECUTE_START", { type: task.type, taskId: task.id, userId: task.context.userId });
  try {
    const result = (await handler(task)) as AgentResponse<TOutput>;
    console.info("DRAKO_AGENT_EXECUTE_SUCCESS", { type: task.type, taskId: task.id, status: result.status });
    return result;
  } catch (error) {
    console.error("DRAKO_AGENT_EXECUTE_FAILED", {
      type: task.type,
      taskId: task.id,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
