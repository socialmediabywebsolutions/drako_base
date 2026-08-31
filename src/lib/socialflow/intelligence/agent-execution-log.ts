export type AgentExecutionStatus = "success" | "error" | "skipped";

async function insertAgentExecutionLog(db: D1Database, row: {
  agentName: string;
  tenantId: string | null;
  saasId: string | null;
  startedAt: string;
  finishedAt: string;
  status: AgentExecutionStatus;
  rowsWritten: number | null;
  errorMessage: string | null;
}): Promise<void> {
  await db.prepare(
    `INSERT INTO agent_execution_log (id, agent_name, tenant_id, saas_id, started_at, finished_at, status, rows_written, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    crypto.randomUUID(),
    row.agentName,
    row.tenantId,
    row.saasId,
    row.startedAt,
    row.finishedAt,
    row.status,
    row.rowsWritten,
    row.errorMessage,
  ).run();
}

// Envuelve una llamada de agente ya existente sin tocar su lógica interna — éxito/error
// se detectan solos, y el resultado (o la excepción) se re-lanza igual que antes para no
// cambiar el try/catch de cada route.ts que ya la llamaba. Un fallo al escribir el log
// nunca debe tumbar la ejecución real del agente, así que ese insert se traga sus propios
// errores.
export async function withAgentExecutionLog<T>(input: {
  db: D1Database;
  agentName: string;
  tenantId: string | null;
  saasId: string | null;
  run: () => Promise<T>;
  rowsWritten?: (result: T) => number | null;
}): Promise<T> {
  const startedAt = new Date().toISOString();
  try {
    const result = await input.run();
    await insertAgentExecutionLog(input.db, {
      agentName: input.agentName,
      tenantId: input.tenantId,
      saasId: input.saasId,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "success",
      rowsWritten: input.rowsWritten ? input.rowsWritten(result) : null,
      errorMessage: null,
    }).catch((err) => console.error("[agent-execution-log] insert failed", err));
    return result;
  } catch (error) {
    await insertAgentExecutionLog(input.db, {
      agentName: input.agentName,
      tenantId: input.tenantId,
      saasId: input.saasId,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "error",
      rowsWritten: null,
      errorMessage: (error instanceof Error ? error.message : String(error)).slice(0, 500),
    }).catch((err) => console.error("[agent-execution-log] insert failed", err));
    throw error;
  }
}

export async function logSkippedAgentExecution(db: D1Database, input: {
  agentName: string;
  tenantId: string | null;
  saasId: string | null;
  reason: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await insertAgentExecutionLog(db, {
    agentName: input.agentName,
    tenantId: input.tenantId,
    saasId: input.saasId,
    startedAt: now,
    finishedAt: now,
    status: "skipped",
    rowsWritten: null,
    errorMessage: input.reason,
  }).catch((err) => console.error("[agent-execution-log] insert failed", err));
}
