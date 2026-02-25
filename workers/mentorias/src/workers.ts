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
