export const SAAS_SLUGS = [
  "drakos",
  "mentorias",
  "bases",
  "socialflows",
  "cryptos",
  "invoices",
  "analytics",
  "automations",
  "cadul",
] as const;

export type SaasesSlugs = (typeof SAAS_SLUGS)[number];

export type SaasesCatalogs = {
  saasSlug: SaasesSlugs;
  workerName: string;
  domainName: string;
  authsSecretName: string;
  requiredSecretsNames: string[];
  requiredBindingsNames: string[];
};

export const SAASES_CATALOGS: Record<SaasesSlugs, SaasesCatalogs> = {
  drakos: {
    saasSlug: "drakos",
    workerName: "saas-drakos-prod",
    domainName: "drakos.drako.systems",
    authsSecretName: "DRAKOS_AUTHS_SECRET",
    requiredSecretsNames: ["DRAKOS_AUTHS_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
  mentorias: {
    saasSlug: "mentorias",
    workerName: "saas-mentorias-prod",
    domainName: "mentorias.drako.systems",
    authsSecretName: "MENTORIAS_AUTHS_SECRET",
    requiredSecretsNames: ["MENTORIAS_AUTHS_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
  bases: {
    saasSlug: "bases",
    workerName: "saas-bases-prod",
    domainName: "bases.drako.systems",
    authsSecretName: "BASES_AUTHS_SECRET",
    requiredSecretsNames: ["BASES_AUTHS_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
  socialflows: {
    saasSlug: "socialflows",
    workerName: "saas-socialflows-prod",
    domainName: "socialflows.drako.systems",
    authsSecretName: "SOCIALFLOWS_AUTHS_SECRET",
    requiredSecretsNames: ["SOCIALFLOWS_AUTHS_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
  cryptos: {
    saasSlug: "cryptos",
    workerName: "saas-cryptos-prod",
    domainName: "cryptos.drako.systems",
    authsSecretName: "CRYPTOS_AUTHS_SECRET",
    requiredSecretsNames: ["CRYPTOS_AUTHS_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
  invoices: {
    saasSlug: "invoices",
    workerName: "saas-invoices-prod",
    domainName: "invoices.drako.systems",
    authsSecretName: "INVOICES_AUTHS_SECRET",
    requiredSecretsNames: ["INVOICES_AUTHS_SECRET", "STRIPE_WEBHOOK_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
  analytics: {
    saasSlug: "analytics",
    workerName: "saas-analytics-prod",
    domainName: "analytics.drako.systems",
    authsSecretName: "ANALYTICS_AUTHS_SECRET",
    requiredSecretsNames: ["ANALYTICS_AUTHS_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
  automations: {
    saasSlug: "automations",
    workerName: "saas-automations-prod",
    domainName: "automations.drako.systems",
    authsSecretName: "AUTOMATIONS_AUTHS_SECRET",
    requiredSecretsNames: ["AUTOMATIONS_AUTHS_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
  cadul: {
    saasSlug: "cadul",
    workerName: "saas-cadul-prod",
    domainName: "cadul.drako.systems",
    authsSecretName: "CADUL_AUTHS_SECRET",
    requiredSecretsNames: ["CADUL_AUTHS_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
};
