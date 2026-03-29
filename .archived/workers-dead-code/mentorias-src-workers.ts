// ARCHIVED: workers/mentorias/src/workers.ts
// Reason: OpenNext is canonical runtime (main = "../../.open-next/worker.js")
// This file was NOT executed in production
// Archived on 2026-03-29 as part of P0 closure

import { createWorkersHandlers } from "../../../packages/shared/workers-handlers";
import { SAAS_SLUGS } from "../../../packages/shared/saases-catalogs";

const handlers = createWorkersHandlers({
  saasSlug: "mentorias",
  workerName: "saas-mentorias-prod",
  domainName: "mentorias.drako.systems",
  aliasDomainNames: ["mentoria.drako.systems"],
  authsSecretName: "MENTORIAS_AUTHS_SECRET",
  allSaasesSlugs: [...SAAS_SLUGS],
});

export default handlers;
