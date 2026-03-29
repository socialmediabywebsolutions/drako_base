export function detectPagesExecutions(runtimeEnv: Record<string, unknown>): boolean {
  return Boolean(
    runtimeEnv.CF_PAGES === "1" ||
      runtimeEnv.CF_PAGES_ENVIRONMENT ||
      runtimeEnv.CF_PAGES_URL ||
      runtimeEnv.CF_PAGES_BRANCH ||
      runtimeEnv.CF_PAGES_COMMIT_SHA,
  );
}

export function buildWorkersOnlyFailures(workerName: string): Response {
  return Response.json(
    {
      ok: false,
      errorCode: "WORKERS_ONLY_ENFORCEMENT",
      message: "This runtime is Workers-only and rejects Pages executions.",
      workerName,
    },
    { status: 503 },
  );
}
