import { createWorkersHandlers } from "../../../packages/shared/workers-handlers";
import { SAAS_SLUGS } from "../../../packages/shared/saases-catalogs";

const handlers = createWorkersHandlers({
  saasSlug: "automations",
  workerName: "saas-automations-prod",
  domainName: "automations.drako.systems",
  authsSecretName: "AUTOMATIONS_AUTHS_SECRET",
  allSaasesSlugs: [...SAAS_SLUGS],
});

export default handlers;
