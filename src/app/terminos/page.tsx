import { LegalLayout, LegalLink, LegalList, LegalSection } from "@/components/legal/legal-layout";
import { LEGAL_HOLDER } from "@/components/legal/legal-data";

export const dynamic = "force-static";

export const metadata = {
  title: "Términos y Condiciones — SocialCors",
  description: "Condiciones de uso y contratación del servicio SocialCors.",
};

export default function TerminosPage() {
  return (
    <LegalLayout
      title="Términos y Condiciones"
      intro={
        <p>
          Estos Términos y Condiciones regulan el uso y la contratación del servicio SocialCors, ofrecido
          por {LEGAL_HOLDER.name}, con DNI {LEGAL_HOLDER.dni} y domicilio en {LEGAL_HOLDER.address}
          (correo electrónico:{" "}
          <LegalLink href={`mailto:${LEGAL_HOLDER.email}`}>{LEGAL_HOLDER.email}</LegalLink>).
        </p>
      }
    >
      <LegalSection title="1. Objeto y aceptación">
        <p>
          Estos términos se aplican a todo el que cree una cuenta y utilice SocialCors, ya sea particular
          (influencer o creador de contenido) o empresa o autónomo. La aceptación se produce al crear la
          cuenta, marcando la casilla correspondiente en el formulario de registro. Si no estás de acuerdo
          con estos términos, no debes crear una cuenta ni utilizar el servicio.
        </p>
        <p>
          Forman parte de la contratación, además, el <LegalLink href="/aviso-legal">Aviso Legal</LegalLink>,
          la <LegalLink href="/privacidad">Política de Privacidad</LegalLink>, la{" "}
          <LegalLink href="/cookies">Política de Cookies</LegalLink> y, para los clientes que traten datos
          personales de terceros mediante el servicio, el <LegalLink href="/dpa">Acuerdo de Encargado del
          Tratamiento (DPA)</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="2. Descripción del servicio">
        <p>
          SocialCors es una plataforma SaaS de automatización de marketing y redes sociales con inteligencia
          artificial. Permite, entre otras funciones, analizar fotos y vídeos, generar contenido adaptado al
          negocio del cliente, programarlo y publicarlo, responder comentarios y mensajes, y consultar
          métricas.
        </p>
        <p>Respecto a las redes sociales integradas:</p>
        <LegalList>
          <li><strong>Instagram:</strong> integración activa.</li>
          <li><strong>LinkedIn:</strong> en desarrollo; puede no estar disponible o no funcionar correctamente.</li>
          <li><strong>Facebook:</strong> preparada, pero no activa.</li>
        </LegalList>
        <p>
          Las funciones en desarrollo o no activas se ofrecen sin ninguna garantía de disponibilidad ni de
          fecha de puesta en marcha.
        </p>
      </LegalSection>

      <LegalSection title="3. Registro y cuenta">
        <LegalList>
          <li>Para usar el servicio es necesario crear una cuenta con un correo electrónico válido y una contraseña.</li>
          <li>El cliente garantiza que los datos que facilita son veraces, completos y actuales, y se compromete a mantenerlos actualizados.</li>
          <li>El cliente es responsable de custodiar sus credenciales y de toda la actividad realizada desde su cuenta. Debe avisar sin demora de cualquier uso no autorizado escribiendo a {LEGAL_HOLDER.email}.</li>
          <li>La cuenta es personal e intransferible.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="4. Prueba gratuita">
        <p>
          Al crear una cuenta se ofrece una prueba gratuita de <strong>15 días, sin necesidad de tarjeta de
          crédito</strong>. Al finalizar la prueba, para seguir utilizando el servicio se solicitará la
          contratación de un plan de pago. La prueba permite evaluar el servicio antes de contratar.
        </p>
      </LegalSection>

      <LegalSection title="5. Planes y precios">
        <p>
          La contratación se realiza mediante una suscripción mensual que se renueva automáticamente cada
          mes hasta que el cliente la cancele. Los planes, sus características y sus límites se muestran en
          la <LegalLink href="/socialflow/planes">página de planes</LegalLink>.
        </p>
        <p>
          Los precios se expresan en euros <strong>sin IVA</strong>. Se añadirá el IVA que corresponda según
          la legislación aplicable. Los precios pueden modificarse con el aviso previo previsto en la
          sección 15.
        </p>
      </LegalSection>

      <LegalSection title="6. Forma de pago">
        <p>
          El pago se realiza mediante tarjeta de crédito o débito a través de Stripe, proveedor de pagos
          que procesa los datos de pago. SocialCors no almacena los números de tarjeta. Si un cobro no
          puede completarse, el acceso a las funciones del servicio podrá limitarse o suspenderse hasta que
          se regularice el pago.
        </p>
      </LegalSection>

      <LegalSection title="7. Cancelación" id="cancelacion">
        <p>
          El cliente puede cancelar su suscripción en cualquier momento desde su cuenta. La cancelación
          impide las renovaciones futuras; el acceso al servicio continúa hasta el final del periodo ya
          pagado. No se realizan reembolsos del periodo en curso.
        </p>
      </LegalSection>

      <LegalSection title="8. Reembolsos" id="reembolsos">
        <p>
          No se realizan reembolsos una vez iniciado el periodo de pago. La prueba gratuita de 15 días está
          pensada para evaluar el servicio antes de contratar. Lo anterior se entiende sin perjuicio de los
          derechos que la ley reconozca al cliente que tenga la condición de consumidor, en particular el
          derecho de desistimiento descrito a continuación.
        </p>
      </LegalSection>

      <LegalSection title="9. Derecho de desistimiento" id="desistimiento">
        <p>
          Si el cliente es un consumidor (particular que contrata al margen de una actividad profesional),
          dispone de un plazo de <strong>14 días naturales</strong> desde la contratación para desistir del
          contrato sin necesidad de justificación, salvo que el servicio ya haya comenzado a prestarse con
          su consentimiento expreso, en cuyo caso se estará a lo que disponga la normativa aplicable. Para
          ejercerlo, basta con comunicarlo a{" "}
          <LegalLink href={`mailto:${LEGAL_HOLDER.email}`}>{LEGAL_HOLDER.email}</LegalLink>. Este derecho
          no corresponde a las empresas y autónomos que contraten en el ámbito de su actividad.
        </p>
      </LegalSection>

      <LegalSection title="10. Obligaciones del cliente">
        <p>El cliente se compromete a:</p>
        <LegalList>
          <li>Utilizar el servicio de forma lícita y conforme a estos términos.</li>
          <li>No realizar scraping ni extracción automatizada de datos o contenidos de la plataforma.</li>
          <li>No compartir su cuenta con terceros ni permitir su uso por personas no autorizadas.</li>
          <li>Respetar los límites del plan contratado.</li>
          <li>Cumplir las condiciones y políticas de las redes sociales que conecte al servicio.</li>
          <li>No utilizar el servicio para publicar contenido ilícito, engañoso o que vulnere derechos de terceros.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="11. Propiedad intelectual">
        <p>
          El contenido generado mediante el servicio pertenece al cliente. SocialCors conserva todos los
          derechos sobre la plataforma, su software, su diseño y su marca. El cliente concede al titular
          los permisos necesarios sobre el contenido que sube para poder prestar el servicio (por ejemplo,
          almacenarlo, procesarlo y publicarlo por cuenta del cliente).
        </p>
      </LegalSection>

      <LegalSection title="12. Contenido y datos de terceros">
        <p>
          El cliente es responsable de contar con los derechos y permisos necesarios sobre el contenido que
          sube (fotos, vídeos, textos, documentos), incluidos los relativos a la imagen y a los datos
          personales de las personas que aparezcan en él, y de cumplir las políticas de las redes sociales
          conectadas.
        </p>
        <p>
          Cuando el servicio trata datos personales de los seguidores o clientes del cliente (por ejemplo,
          comentarios y mensajes recibidos en sus redes), SocialCors actúa como encargado del tratamiento
          conforme al <LegalLink href="/dpa">DPA</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="13. Contenido generado con inteligencia artificial">
        <p>
          El servicio utiliza proveedores de inteligencia artificial para generar textos, imágenes, vídeos
          y respuestas. Este contenido puede contener errores o imprecisiones. El cliente es responsable de
          revisarlo antes de su publicación y de que su uso cumpla la normativa y las condiciones de las
          plataformas en las que lo publique.
        </p>
      </LegalSection>

      <LegalSection title="14. Limitación de responsabilidad">
        <p>
          El servicio se presta «tal cual», con la diligencia razonable, pero sin garantizar su
          disponibilidad ininterrumpida ni la ausencia de errores. SocialCors no responde de los daños
          derivados de la interrupción, cambios o restricciones de las redes sociales y proveedores de
          terceros, ni del uso que el cliente haga del contenido generado. En la medida permitida por la
          ley, el titular no responderá de los daños indirectos ni del lucro cesante. Nada de lo anterior
          limita la responsabilidad que no pueda excluirse legalmente.
        </p>
      </LegalSection>

      <LegalSection title="15. Modificaciones de los términos">
        <p>
          SocialCors podrá modificar estos términos y los precios. Los cambios se comunicarán al cliente con
          <strong> 30 días de antelación</strong>. Si el cliente no está de acuerdo, podrá cancelar su
          suscripción antes de la entrada en vigor de los cambios.
        </p>
      </LegalSection>

      <LegalSection title="16. Legislación aplicable y jurisdicción">
        <p>
          Estos términos se rigen por la legislación española. Las partes se someten a los tribunales
          españoles competentes, sin perjuicio de la legislación imperativa del país de residencia del
          consumidor.
        </p>
        <p>
          Sin perjuicio de lo anterior, los consumidores residentes en otros países de la Unión Europea o
          Latinoamérica podrán acogerse a la legislación imperativa de protección al consumidor de su país
          de residencia.
        </p>
      </LegalSection>

      <LegalSection title="17. Contacto">
        <p>
          Para cualquier consulta sobre estos términos puedes escribir a{" "}
          <LegalLink href={`mailto:${LEGAL_HOLDER.email}`}>{LEGAL_HOLDER.email}</LegalLink>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
