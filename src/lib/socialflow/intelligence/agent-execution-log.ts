export type AgentExecutionStatus = "success" | "error" | "skipped" | "started" | "completed";

// Exportada (además de usada internamente por withAgentExecutionLog) para que agentes
// con riesgo de morir a mitad de ejecución (límite de CPU/subrequests del Worker,
// nunca llegan al catch de withAgentExecutionLog) puedan insertar una fila 'started'
// optimista al entrar — ver runCrossTenantIntelligenceCron/runViralOpportunityCron.
// Devuelve el id insertado para que el caller pueda actualizarlo luego con
// updateAgentExecutionLog.
export async function insertAgentExecutionLog(db: D1Database, row: {
  agentName: string;
  tenantId: string | null;
  saasId: string | null;
  startedAt: string;
  finishedAt: string;
  status: AgentExecutionStatus;
  rowsWritten: number | null;
  errorMessage: string | null;
  id?: string;
}): Promise<string> {
  const id = row.id ?? crypto.randomUUID();
  await db.prepare(
    `INSERT INTO agent_execution_log (id, agent_name, tenant_id, saas_id, started_at, finished_at, status, rows_written, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id,
    row.agentName,
    row.tenantId,
    row.saasId,
    row.startedAt,
    row.finishedAt,
    row.status,
    row.rowsWritten,
    row.errorMessage,
  ).run();
  return id;
}

// Actualiza la fila 'started' de insertAgentExecutionLog a su estado final
// ('completed' en el caso feliz). Mismo criterio que el resto de este archivo: un
// fallo al escribir el log nunca debe tumbar la ejecución real del agente, así que
// este update se traga sus propios errores.
export async function updateAgentExecutionLog(
  db: D1Database,
  id: string,
  update: {
    status: AgentExecutionStatus;
    finishedAt: string;
    rowsWritten?: number | null;
    errorMessage?: string | null;
  },
): Promise<void> {
  try {
    await db.prepare(
      `UPDATE agent_execution_log SET status = ?, finished_at = ?, rows_written = ?, error_message = ? WHERE id = ?`,
    ).bind(
      update.status,
      update.finishedAt,
      update.rowsWritten ?? null,
      update.errorMessage ?? null,
      id,
    ).run();
  } catch (err) {
    console.error("[agent-execution-log] update failed", err);
  }
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
