import { createWorkersHandlers } from "../../../packages/shared/workers-handlers";
import { SAAS_SLUGS } from "../../../packages/shared/saases-catalogs";

const handlers = createWorkersHandlers({
  saasSlug: "analytics",
  workerName: "saas-analytics-prod",
  domainName: "analytics.drako.systems",
  authsSecretName: "ANALYTICS_AUTHS_SECRET",
  allSaasesSlugs: [...SAAS_SLUGS],
});

export default handlers;
