# Workers Multi SaaS Audit

Generated at: 2026-02-25T16:36:09Z

## Scope
- Validation target: Workers-only multi-worker SaaS artifacts (8 slugs).
- Import rule applied: new code uses relative imports only (no `@/` in generated artifacts).

## Checklist Status
- [x] Directory: `packages/shared`
- [x] Directory: `workers/drakos`
- [x] Directory: `workers/mentorias`
- [x] Directory: `workers/bases`
- [x] Directory: `workers/socialflows`
- [x] Directory: `workers/cryptos`
- [x] Directory: `workers/invoices`
- [x] Directory: `workers/analytics`
- [x] Directory: `workers/automations`
- [x] Directory: `apps/drakos`
- [x] Directory: `apps/mentorias`
- [x] Directory: `apps/bases`
- [x] Directory: `apps/socialflows`
- [x] Directory: `apps/cryptos`
- [x] Directory: `apps/invoices`
- [x] Directory: `apps/analytics`
- [x] Directory: `apps/automations`
- [x] Directory: `docs/runbooks`
- [x] File: `scripts/check-workers-multi-saas.sh`
- [x] File: `scripts/check-workers-multi-saas.ps1`
- [x] File: `docs/runbooks/workers-multi-saas.md`
- [x] File: `docs/runbooks/workers-multi-saas-migrations-no-downtime.md`
- [x] File: `docs/runbooks/workers-multi-saas-files.md`
- [x] File: `workers/drakos/wrangler.workers.toml`
- [x] File: `workers/drakos/src/workers.ts`
- [x] File: `workers/drakos/package.json`
- [x] File: `workers/mentorias/wrangler.workers.toml`
- [x] File: `workers/mentorias/src/workers.ts`
- [x] File: `workers/mentorias/package.json`
- [x] File: `workers/bases/wrangler.workers.toml`
- [x] File: `workers/bases/src/workers.ts`
- [x] File: `workers/bases/package.json`
- [x] File: `workers/socialflows/wrangler.workers.toml`
- [x] File: `workers/socialflows/src/workers.ts`
- [x] File: `workers/socialflows/package.json`
- [x] File: `workers/cryptos/wrangler.workers.toml`
- [x] File: `workers/cryptos/src/workers.ts`
- [x] File: `workers/cryptos/package.json`
- [x] File: `workers/invoices/wrangler.workers.toml`
- [x] File: `workers/invoices/src/workers.ts`
- [x] File: `workers/invoices/package.json`
- [x] File: `workers/analytics/wrangler.workers.toml`
- [x] File: `workers/analytics/src/workers.ts`
- [x] File: `workers/analytics/package.json`
- [x] File: `workers/automations/wrangler.workers.toml`
- [x] File: `workers/automations/src/workers.ts`
- [x] File: `workers/automations/package.json`

## Relevant Tree
```text
apps/analytics/dashboards/admins.html
apps/analytics/dashboards/clients.html
apps/analytics/routings.json
apps/automations/dashboards/admins.html
apps/automations/dashboards/clients.html
apps/automations/routings.json
apps/bases/dashboards/admins.html
apps/bases/dashboards/clients.html
apps/bases/routings.json
apps/cryptos/dashboards/admins.html
apps/cryptos/dashboards/clients.html
apps/cryptos/routings.json
apps/drakos/dashboards/admins.html
apps/drakos/dashboards/clients.html
apps/drakos/routings.json
apps/invoices/dashboards/admins.html
apps/invoices/dashboards/clients.html
apps/invoices/routings.json
apps/mentorias/dashboards/admins.html
apps/mentorias/dashboards/clients.html
apps/mentorias/routings.json
apps/socialflows/dashboards/admins.html
apps/socialflows/dashboards/clients.html
apps/socialflows/routings.json
docs/audits/workers-multi-saas-audit.md
docs/audits/workers-multi-saas-git-diff-stat.txt
docs/audits/workers-multi-saas-git-status.txt
docs/audits/workers-multi-saas-tsc.txt
docs/runbooks/workers-multi-saas-files.md
docs/runbooks/workers-multi-saas-migrations-no-downtime.md
docs/runbooks/workers-multi-saas-plan.md
docs/runbooks/workers-multi-saas.md
packages/shared/auths-isolations.ts
packages/shared/dashboards-templates.ts
packages/shared/hosts-fencings.ts
packages/shared/platforms-failures.ts
packages/shared/saases-catalogs.ts
packages/shared/workers-handlers.ts
scripts/check-workers-multi-saas.ps1
scripts/check-workers-multi-saas.sh
workers/analytics/package.json
workers/analytics/src/workers.ts
workers/analytics/wrangler.workers.toml
workers/automations/package.json
workers/automations/src/workers.ts
workers/automations/wrangler.workers.toml
workers/bases/package.json
workers/bases/src/workers.ts
workers/bases/wrangler.workers.toml
workers/cryptos/package.json
workers/cryptos/src/workers.ts
workers/cryptos/wrangler.workers.toml
workers/drakos/package.json
workers/drakos/src/workers.ts
workers/drakos/wrangler.workers.toml
workers/invoices/package.json
workers/invoices/src/workers.ts
workers/invoices/wrangler.workers.toml
workers/mentorias/package.json
workers/mentorias/src/workers.ts
workers/mentorias/wrangler.workers.toml
workers/socialflows/package.json
workers/socialflows/src/workers.ts
workers/socialflows/wrangler.workers.toml
```

## Workers Configurations
| Slug | Worker Name | Route Pattern | Domain | workers_dev | compatibility_date | Auth Secret Variable | Bindings |
|---|---|---|---|---|---|---|---|
| drakos | saas-drakos-prod | `drakos.drako.systems/*` | `drakos.drako.systems` | false | 2024-11-01 | `DRAKOS_AUTHS_SECRET` | D1:SAASES_DB, KV:SAASES_CACHE, R2:SAASES_STORAGE, QUEUE:SAASES_EVENTS |
| mentorias | saas-mentorias-prod | `mentorias.drako.systems/*` | `mentorias.drako.systems` | false | 2024-11-01 | `MENTORIAS_AUTHS_SECRET` | D1:SAASES_DB, KV:SAASES_CACHE, R2:SAASES_STORAGE, QUEUE:SAASES_EVENTS |
| bases | saas-bases-prod | `bases.drako.systems/*` | `bases.drako.systems` | false | 2024-11-01 | `BASES_AUTHS_SECRET` | D1:SAASES_DB, KV:SAASES_CACHE, R2:SAASES_STORAGE, QUEUE:SAASES_EVENTS |
| socialflows | saas-socialflows-prod | `socialflows.drako.systems/*` | `socialflows.drako.systems` | false | 2024-11-01 | `SOCIALFLOWS_AUTHS_SECRET` | D1:SAASES_DB, KV:SAASES_CACHE, R2:SAASES_STORAGE, QUEUE:SAASES_EVENTS |
| cryptos | saas-cryptos-prod | `cryptos.drako.systems/*` | `cryptos.drako.systems` | false | 2024-11-01 | `CRYPTOS_AUTHS_SECRET` | D1:SAASES_DB, KV:SAASES_CACHE, R2:SAASES_STORAGE, QUEUE:SAASES_EVENTS |
| invoices | saas-invoices-prod | `invoices.drako.systems/*` | `invoices.drako.systems` | false | 2024-11-01 | `INVOICES_AUTHS_SECRET` | D1:SAASES_DB, KV:SAASES_CACHE, R2:SAASES_STORAGE, QUEUE:SAASES_EVENTS |
| analytics | saas-analytics-prod | `analytics.drako.systems/*` | `analytics.drako.systems` | false | 2024-11-01 | `ANALYTICS_AUTHS_SECRET` | D1:SAASES_DB, KV:SAASES_CACHE, R2:SAASES_STORAGE, QUEUE:SAASES_EVENTS |
| automations | saas-automations-prod | `automations.drako.systems/*` | `automations.drako.systems` | false | 2024-11-01 | `AUTOMATIONS_AUTHS_SECRET` | D1:SAASES_DB, KV:SAASES_CACHE, R2:SAASES_STORAGE, QUEUE:SAASES_EVENTS |

## Key Files Hashes And Sizes
| File | Size (bytes) | SHA-256 |
|---|---:|---|
| `packages/shared/auths-isolations.ts` | 7172 | `3eb6339c1e1cc176571fedfebc11f319470cfe9f86346b1abcc4f808aeac4416` |
| `packages/shared/dashboards-templates.ts` | 4610 | `6b40ef0e91b4a2dea071f82cd57d7d14f8426bf30bbab791d84110f703ef17eb` |
| `packages/shared/hosts-fencings.ts` | 1625 | `b2861dbc1e6b31342358808cc6471ec599ee5229513cded4ce268bd1b445f8ff` |
| `packages/shared/platforms-failures.ts` | 590 | `e4d975f3ed4749bc45ebe02a2aab22b080c932cec218abdd61bf3135b3e22e0b` |
| `packages/shared/saases-catalogs.ts` | 3145 | `60698d713b6bfd07fffd3b469b99ffa9df520ce280b0f5ed4215f5d975e52e26` |
| `packages/shared/workers-handlers.ts` | 6265 | `aad1f75f109c6e2848e321c76e86c9a4935a4c470012271087a386d87c803ff2` |
| `scripts/check-workers-multi-saas.sh` | 872 | `48cc6a1105cc615cff045d4c9946164a824a3263dc7d1682f6be1c7f4b603927` |
| `scripts/check-workers-multi-saas.ps1` | 1545 | `0ba9bf94aae39ae6214c1f07afcf6c2a5a762cc39d5cc92b8025a8735a41000e` |
| `docs/runbooks/workers-multi-saas.md` | 6535 | `e9584fee45f46a50c2c27b648874f013f624e7b1ba5a73459e1bf962d6cbfa91` |
| `docs/runbooks/workers-multi-saas-migrations-no-downtime.md` | 1581 | `bb402b9524f380c721710c098d28a1ff73dc4534e80e9054fefc1dfade3dbaaf` |
| `docs/runbooks/workers-multi-saas-files.md` | 60365 | `30a6d85897b51f1d2612d97f764ff0ac89b12cbe9cbb2cc7d4a6428830aaf502` |
| `workers/drakos/wrangler.workers.toml` | 723 | `66c5ed10b8c343f2ecee34b9136471363d82720e9a93a1e19cdee0b643d02c12` |
| `workers/drakos/src/workers.ts` | 436 | `9a94f06a1c73deeef270cd1c9e8d58119bd46d3b8f24ece1f3503cd73090f941` |
| `workers/drakos/package.json` | 299 | `f50f9547a7d0844780097ce9c3d259263fe30b95c4e0877073370a97edbdf20e` |
| `apps/drakos/routings.json` | 316 | `495e2445048f6cad8dfa2be64afef340d182bca3f505e6318fa76e1138a1d24d` |
| `apps/drakos/dashboards/clients.html` | 772 | `9431fdb95db810d6833ea0aeb668820f0ace27b9cf007952f22f37ccbc92f666` |
| `apps/drakos/dashboards/admins.html` | 795 | `80d40810ca69d76db0403e8a861835e73ca966ade4319ce21487fb7524fad720` |
| `workers/mentorias/wrangler.workers.toml` | 753 | `13771fd387d32dd3fea89ae8050f433bc73410e7181ddd365d0d03a93376ce53` |
| `workers/mentorias/src/workers.ts` | 457 | `66f1984bd4fe3cf00884dcb1e579b8059cc0b581d956d2f9984b4db3e63253ad` |
| `workers/mentorias/package.json` | 305 | `9a3911f8c673a29dd84db793097ef3fc7b25fe4b73adb921a09c3e4bc87f348c` |
| `apps/mentorias/routings.json` | 322 | `8458c986f77a083b6fef4ddff4b30a1ca74909107b0652b1ecfd20e85539b8d8` |
| `apps/mentorias/dashboards/clients.html` | 781 | `28e154e8ee7278026c310a4fa57b35adb35943b50e9f6a094f924875323dcd4b` |
| `apps/mentorias/dashboards/admins.html` | 801 | `cd5b003cb5f13a00c3fd059f15e69e7e2669292d67b654e100781ac2024c52cd` |
| `workers/bases/wrangler.workers.toml` | 713 | `339dafba0810da38b804e13792b8c7e1a1101dbb43a572b8f9df2ef105270d95` |
| `workers/bases/src/workers.ts` | 460 | `c47ad4510af7c7e22327d0e76af7acb657a81eaa7f2bafe527d4c43fea694138` |
| `workers/bases/package.json` | 297 | `56bd790d34a0a828cd0339c1f53f54d0a91c040a0e606dcb6016d7d9bf6a713f` |
| `apps/bases/routings.json` | 314 | `7da06d8a0bed01270640b78e2fcc4f8d3b5c53685abdc69d601127b5c3c08854` |
| `apps/bases/dashboards/clients.html` | 769 | `ccc5881cf46136ba312f3799054f62d8a0763387085771d6fb17c0ffa2239e22` |
| `apps/bases/dashboards/admins.html` | 793 | `fad5cee60d0b6a1819e5e320c913cd0e78365cecae31b4d16553ecac2663fd90` |
| `workers/socialflows/wrangler.workers.toml` | 773 | `3f3d50908fd0e6095a69358520d72fdfcc3eff392a7a5003521e4b60058754c0` |
| `workers/socialflows/src/workers.ts` | 417 | `98a19d83ec3731c5f3aeb264258151d0d42275c063d8ee5a6d8c9e29d45ad582` |
| `workers/socialflows/package.json` | 309 | `73c57bda0d6dce50da12e44337e8be331920847c47b8292bd29a04ce40d02f51` |
| `apps/socialflows/routings.json` | 326 | `c902deba41df14e22f00944aec46b43933787a81ad3b74d36ef3e39309eaa893` |
| `apps/socialflows/dashboards/clients.html` | 787 | `c19b8bf377fd5ab1a75a38fdee8a5faed28a4adc60831f610e6c6e1cdb26ba33` |
| `apps/socialflows/dashboards/admins.html` | 805 | `cf5a582746126e58eccebaaa26da63a26466d2f7470e926bafa4dd1bde733b12` |
| `workers/cryptos/wrangler.workers.toml` | 733 | `97f67a5dd8d1db3b7072b8964b0b802adbffe219bafcc76274508e67b6c69c7f` |
| `workers/cryptos/src/workers.ts` | 401 | `9777c461a4378a76b55ef31a1a13223e64294c5ff8cf1950d15f03fc5aa0bcee` |
| `workers/cryptos/package.json` | 301 | `b969d8a605415c67af6effbfc3896c469777ddb1235388a596a7571ec3a4185c` |
| `apps/cryptos/routings.json` | 318 | `3855df6998a11e880a426757f6a84f1dca0d06a51accd465d440bbba291887af` |
| `apps/cryptos/dashboards/clients.html` | 775 | `c37e1d970925f31b747381eb71541152763d52b973157ca8d06a834cbfcc9620` |
| `apps/cryptos/dashboards/admins.html` | 797 | `5c5f639f48d5faf763153d3d235ced2891e171a6edbaaae207cfaf4463ecf693` |
| `workers/invoices/wrangler.workers.toml` | 743 | `1914ef64e2f0c5ea6f0cd8ba0119f4e4d3b83fd67e8d3ae8331eb320a5f8b766` |
| `workers/invoices/src/workers.ts` | 405 | `96f9ee49ae60b0e9c708103c6bcfa10bf4a12d61142307a19b1d01f0d001b88f` |
| `workers/invoices/package.json` | 303 | `ae9d38c0357f612ec607b40abb8316280bb48bc3036e74c79f7b4e42d1f437d0` |
| `apps/invoices/routings.json` | 320 | `d6d274b7e7f589eed6c5f448dbfde5f56815b7ff3f64318e650b37d4ceda8c65` |
| `apps/invoices/dashboards/clients.html` | 778 | `a810b7b43799bca4af49371fdfd183808a30d2b3dda5d70fb7f0cd36ec6f8316` |
| `apps/invoices/dashboards/admins.html` | 799 | `5d45a085f3697bf45e0f02d2745a060170159e92d425f0e57b64e183246d219d` |
| `workers/analytics/wrangler.workers.toml` | 753 | `758b5b71d635ef1ab1d169949a1985f243e221f6afb5f329d721e45216e4d4c8` |
| `workers/analytics/src/workers.ts` | 409 | `cfe3fa7c91de6c96eedb527072b5a572a4a7dc251896da42baffe3b6976305bb` |
| `workers/analytics/package.json` | 305 | `3b19db3d7e36397948ed9409bc39f9b8caaf292e2eb6b78afd736757feed86f1` |
| `apps/analytics/routings.json` | 322 | `1330212714275397edf176136fc7df5c60ead6603652cc89656aa8889a57ed3f` |
| `apps/analytics/dashboards/clients.html` | 781 | `d96950def1d389d682f542dd316ab39f66aeefe719ea3ccb2a99c4b503431f86` |
| `apps/analytics/dashboards/admins.html` | 801 | `25c6f178749024c6db42e3a34c876842d6733fce7a20de12a5948ff33728cdd7` |
| `workers/automations/wrangler.workers.toml` | 773 | `0449283675e0df0b38c9845fadf7e19eaf87e30d9c08a6e1809f2f8651c3429b` |
| `workers/automations/src/workers.ts` | 417 | `609df5993499bf98f11cbc6f13c02f958681614b8c1f3c9f349f7c846428ae18` |
| `workers/automations/package.json` | 309 | `27fc0b6f646426638d209be68d00333ce1c9489a79c7a0644a23ae9d37eb42b9` |
| `apps/automations/routings.json` | 326 | `c070ba8b1c1d3c8729342d55224f3cef407907648fc4de0c9ff6ffe335d2ca81` |
| `apps/automations/dashboards/clients.html` | 787 | `9dbf2d9af90a7b09d3b1a5ff1fe0ba19a897d1da4d0d64f3004d960177c84d54` |
| `apps/automations/dashboards/admins.html` | 805 | `871c465969214d64367507a31f674a91791aa889fcc71e99c2ea347359ed25e9` |

## Command Outputs
- Full `git status` output: `docs/audits/workers-multi-saas-git-status.txt`
- Full `git diff --stat` output: `docs/audits/workers-multi-saas-git-diff-stat.txt`
- Full `pnpm exec tsc --noEmit --pretty false packages/shared/*.ts workers/*/src/workers.ts` output: `docs/audits/workers-multi-saas-tsc.txt`

### `pnpm exec tsc --noEmit` Result
```text
exit_code=0
```

## Runtime Validation Commands (No Deploy Required)
```bash
curl -sS https://drakos.drako.systems/api/health | jq
curl -sS https://mentorias.drako.systems/api/health | jq
curl -sS https://bases.drako.systems/api/health | jq
curl -sS https://socialflows.drako.systems/api/health | jq
curl -sS https://cryptos.drako.systems/api/health | jq
curl -sS https://invoices.drako.systems/api/health | jq
curl -sS https://analytics.drako.systems/api/health | jq
curl -sS https://automations.drako.systems/api/health | jq

# host fencing negative test (expect HTTP/1.1 403)
curl -sS -i https://drakos.drako.systems/api/health -H 'Host: mentorias.drako.systems' | head -n 1
```
