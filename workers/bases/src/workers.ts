import { createWorkersHandlers } from "../../../packages/shared/workers-handlers";
import { SAAS_SLUGS } from "../../../packages/shared/saases-catalogs";

const handlers = createWorkersHandlers({
  saasSlug: "bases",
  workerName: "saas-bases-prod",
  domainName: "bases.drako.systems",
  aliasDomainNames: ["base.drako.systems", "admin.drako.systems"],
  authsSecretName: "BASES_AUTHS_SECRET",
  allSaasesSlugs: [...SAAS_SLUGS],
});

export default handlers;
