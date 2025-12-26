# Packs & Blueprint Templates v1

## Packs disponibles
- `drako_clinic_pack` (CLINIC)
- `drako_salon_pack` (SALON)
- `drako_pet_grooming_pack` (PET_GROOMING)
- `drako_laundry_pack` (LAUNDRY)

Cada pack define:
- módulos del Blueprint recomendados (fases + estado base)
- features recomendadas (saas_features)
- tags de knowledge/playbooks
- campañas sociales sugeridas (opcional)

## APIs
- `GET /api/packs` → lista de packs
- `GET /api/packs/current?saasId=...` → pack sugerido/actual y motivo
- `POST /api/packs/apply` → aplica el pack (features + blueprint)

## Cómo se aplica
El pack activa features faltantes y crea módulos del blueprint que no existan aún. No desactiva módulos ya existentes ni pisa manual/plan.

## Relación con Features & Blueprint
- Features se sincronizan con Plan o Blueprint; el pack completa lo que falta.
- Blueprint usa los módulos recomendados del pack para acelerar la fase inicial.

## Knowledge & Playbooks
Los tags de pack se usan como hints en Tasks/Autopilot para recomendar playbooks relevantes.

## Pricing recomendado (referencia, no hardcode)
Planes por SaaS:
- **Core**: SaaS + IA + WhatsApp basico + Tasks + Knowledge basica. Rango 199-249 EUR/mes.
- **Growth**: Core + Social Engine (8 posts/mes) + Tax basico. Rango 299-349 EUR/mes.
- **Pro**: Growth + 12-16 posts/mes + reporting avanzado + soporte prioritario. Rango 399-549 EUR/mes.

Posts incluidos por plan:
- Core: 4 posts organicos/mes
- Growth: 8 posts/mes
- Pro: 12-16 posts/mes

Packs extra (adicional al plan):
- Social Pack +8 posts/mes: +80-120 EUR/mes
- Social Pack +16 posts/mes: +140-200 EUR/mes
- Gestion de Ads (Google/Meta): fee fijo 100-250 EUR/mes

Nota: el presupuesto de Ads lo paga el cliente directamente a Google/Meta. Drako solo cobra la gestion si se contrata ese modulo.
