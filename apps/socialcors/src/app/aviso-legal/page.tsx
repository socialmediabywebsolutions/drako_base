import { LegalIdentity, LegalLayout, LegalLink, LegalList, LegalSection } from "@/components/socialflow/legal/legal-layout";
import { LEGAL_HOLDER } from "@/components/socialflow/legal/legal-data";

export const dynamic = "force-static";

export const metadata = {
  title: "Aviso Legal — SocialCors",
  description: "Aviso Legal e identificación del titular del sitio web y del servicio SocialCors.",
};

export default function AvisoLegalPage() {
  const activity = LEGAL_HOLDER.activity.charAt(0).toLowerCase() + LEGAL_HOLDER.activity.slice(1);
  return (
    <LegalLayout
      title="Aviso Legal"
      intro={
        <p>
          En cumplimiento del deber de información de la Ley 34/2002, de Servicios de la Sociedad de la
          Información y de Comercio Electrónico (LSSI-CE), se facilitan a continuación los datos
          identificativos del titular de este sitio web.
        </p>
      }
    >
      <LegalSection title="1. Identificación del titular">
        <LegalIdentity />
      </LegalSection>

      <LegalSection title="2. Objeto">
        <p>
          El presente Aviso Legal regula el acceso y el uso del sitio web {LEGAL_HOLDER.web} y del servicio
          que se ofrece a través de él: una {activity}. Los servicios se dirigen tanto a
          particulares (influencers y creadores de contenido) como a empresas y autónomos.
        </p>
        <p>
          El acceso al sitio web atribuye la condición de usuario e implica la aceptación de este Aviso
          Legal. Quienes creen una cuenta y contraten el servicio quedan sometidos, además, a los{" "}
          <LegalLink href="/terminos">Términos y Condiciones</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="3. Propiedad intelectual e industrial">
        <p>
          El software, el diseño, los textos, las imágenes, los logotipos, la marca «SocialCors» y demás
          elementos de este sitio web y de la plataforma son titularidad del titular o de sus licenciantes,
          y están protegidos por la normativa de propiedad intelectual e industrial. Queda prohibida su
          reproducción, distribución, comunicación pública o transformación sin autorización previa y por
          escrito, salvo en los casos permitidos por la ley.
        </p>
        <p>
          El contenido que el cliente crea, sube o genera mediante el servicio se rige por lo dispuesto en
          los <LegalLink href="/terminos">Términos y Condiciones</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="4. Condiciones de uso">
        <p>El usuario se compromete a utilizar el sitio web y el servicio de conformidad con la ley, la buena fe y el orden público. En particular, se compromete a no:</p>
        <LegalList>
          <li>Utilizarlos con fines ilícitos o lesivos de derechos o intereses de terceros.</li>
          <li>Intentar acceder sin autorización a sistemas, cuentas o datos de otros usuarios.</li>
          <li>Realizar acciones que puedan dañar, sobrecargar o inutilizar el sitio web o la plataforma.</li>
          <li>Introducir programas o contenidos maliciosos.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Responsabilidad">
        <p>
          El titular procura que la información y el servicio sean correctos y estén disponibles, pero no
          garantiza la ausencia de errores ni la disponibilidad ininterrumpida del sitio web o de la
          plataforma, ni se responsabiliza de los daños derivados de interrupciones o fallos ajenos a su
          control, incluidos los de las redes sociales y proveedores de terceros conectados.
        </p>
        <p>
          El sitio web puede contener enlaces a sitios de terceros sobre cuyo contenido el titular no
          ejerce control y de los que no se hace responsable. El contenido generado con ayuda de
          inteligencia artificial puede contener errores, por lo que debe ser revisado por el usuario antes
          de su publicación.
        </p>
      </LegalSection>

      <LegalSection title="6. Protección de datos y cookies">
        <p>
          El tratamiento de datos personales se describe en la{" "}
          <LegalLink href="/privacidad">Política de Privacidad</LegalLink> y el uso de cookies en la{" "}
          <LegalLink href="/cookies">Política de Cookies</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="7. Legislación aplicable y jurisdicción">
        <p>
          Este Aviso Legal se rige por la legislación española. Para la resolución de cualquier controversia
          serán competentes los tribunales españoles, sin perjuicio de la legislación imperativa del país de
          residencia del consumidor.
        </p>
      </LegalSection>

      <LegalSection title="8. Contacto">
        <p>
          Para cualquier consulta sobre este Aviso Legal puedes escribir a{" "}
          <LegalLink href={`mailto:${LEGAL_HOLDER.email}`}>{LEGAL_HOLDER.email}</LegalLink>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
