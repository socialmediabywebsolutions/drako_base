import { createWorkersHandlers } from "../../../packages/shared/workers-handlers";
import { SAAS_SLUGS } from "../../../packages/shared/saases-catalogs";

const handlers = createWorkersHandlers({
  saasSlug: "drakos",
  workerName: "saas-drakos-prod",
  domainName: "drakos.drako.systems",
  aliasDomainNames: ["drako.systems"],
  authsSecretName: "DRAKOS_AUTHS_SECRET",
  allSaasesSlugs: [...SAAS_SLUGS],
});

export default handlers;
