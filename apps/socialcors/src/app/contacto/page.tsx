import { LegalLayout, LegalLink, LegalSection } from "@/components/socialflow/legal/legal-layout";
import { LEGAL_HOLDER } from "@/components/socialflow/legal/legal-data";

export const dynamic = "force-static";

export const metadata = {
  title: "Contacto — SocialCors",
  description: "Cómo contactar con SocialCors.",
};

export default function ContactoPage() {
  return (
    <LegalLayout title="Contacto">
      <LegalSection title="Consultas sobre SocialCors">
        <p>
          Para cualquier consulta sobre SocialCors, escríbenos a{" "}
          <LegalLink href={`mailto:${LEGAL_HOLDER.email}`}>{LEGAL_HOLDER.email}</LegalLink>. Respondemos en un
          plazo máximo de 48 horas laborables.
        </p>
      </LegalSection>

      <LegalSection title="Privacidad y protección de datos">
        <p>
          Para cuestiones de privacidad y protección de datos, escríbenos también a{" "}
          <LegalLink href={`mailto:${LEGAL_HOLDER.email}?subject=Protecci%C3%B3n%20de%20datos`}>{LEGAL_HOLDER.email}</LegalLink>{" "}
          indicando en el asunto «Protección de datos». Puedes consultar cómo tratamos tus datos en la{" "}
          <LegalLink href="/privacidad">Política de Privacidad</LegalLink>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
