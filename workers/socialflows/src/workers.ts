import { createWorkersHandlers } from "../../../packages/shared/workers-handlers";
import { SAAS_SLUGS } from "../../../packages/shared/saases-catalogs";

const handlers = createWorkersHandlers({
  saasSlug: "socialflows",
  workerName: "saas-socialflows-prod",
  domainName: "socialflows.drako.systems",
  aliasDomainNames: ["socialflow.drako.systems"],
  authsSecretName: "SOCIALFLOWS_AUTHS_SECRET",
  allSaasesSlugs: [...SAAS_SLUGS],
});

export default handlers;
