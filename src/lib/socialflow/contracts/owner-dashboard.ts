// El holding solo usa el tipo SocialOwnerSummary (src/lib/owner/types.ts).
// La atribución de citas/ingresos a campañas (appointments + economy en DRACO_DB) se
// eliminó de SocialCors en la P5: no tenía consumidores. Si el holding la necesita, la
// calcula él a partir del contrato interno.
export type { SocialOwnerSummary } from "@/lib/socialflow/repository";
