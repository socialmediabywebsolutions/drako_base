import { createWorkersHandlers } from "../../../packages/shared/workers-handlers";
import { SAAS_SLUGS } from "../../../packages/shared/saases-catalogs";

const handlers = createWorkersHandlers({
  saasSlug: "cryptos",
  workerName: "saas-cryptos-prod",
  domainName: "cryptos.drako.systems",
  authsSecretName: "CRYPTOS_AUTHS_SECRET",
  allSaasesSlugs: [...SAAS_SLUGS],
});

export default handlers;
