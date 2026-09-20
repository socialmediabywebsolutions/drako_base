import { LegalIdentity, LegalLayout, LegalLink, LegalList, LegalSection } from "@/components/legal/legal-layout";
import { EDPB_MEMBERS_URL, LEGAL_HOLDER } from "@/components/legal/legal-data";

export const dynamic = "force-static";

export const metadata = {
  title: "Política de Privacidad — Socialcors",
  description: "Cómo trata SocialCors tus datos personales: responsable, finalidades, destinatarios, conservación y derechos.",
};

export default function PrivacidadPage() {
  const mail = <LegalLink href={`mailto:${LEGAL_HOLDER.email}`}>{LEGAL_HOLDER.email}</LegalLink>;

  return (
    <LegalLayout
      title="Política de Privacidad"
      intro={
        <p>
          SocialCors es un servicio de gestión y automatización de redes sociales con inteligencia
          artificial, dirigido a influencers, creadores, empresas y autónomos, que analiza fotos y contexto
          de marca para generar contenido, publicarlo, responder comentarios y mensajes directos y detectar
          oportunidades de venta (leads). Esta política explica qué datos tratamos para prestar ese servicio,
          con qué finalidad y base jurídica, con quién los compartimos, cuánto tiempo los conservamos y cómo
          puedes ejercer tus derechos.
        </p>
      }
    >
      <LegalSection title="1. Responsable del tratamiento">
        <LegalIdentity />
        <p>Para cualquier consulta sobre esta política o para ejercer tus derechos, escríbenos a {mail}.</p>
      </LegalSection>

      <LegalSection title="2. Qué datos tratamos">
        <p>Según las funciones que utilices, tratamos:</p>
        <LegalList>
          <li><strong>Datos de cuenta:</strong> nombre, correo electrónico y contraseña. De la contraseña solo se almacena una versión protegida mediante hash con sal; nunca en texto plano.</li>
          <li><strong>Datos de facturación y pago:</strong> gestionados por Stripe. SocialCors no almacena números de tarjeta.</li>
          <li><strong>Contenido que subes:</strong> fotos y vídeos, documentos y direcciones web de tu Base de conocimiento y datos de tu marca o negocio (nombre, descripción, tono de voz, público objetivo). Si incorporas datos o imágenes de personas de tu equipo o de terceros, ver la sección 9.</li>
          <li><strong>Datos de las redes sociales que conectas:</strong> tokens de acceso OAuth (almacenados cifrados), datos básicos de la cuenta, publicaciones, métricas e insights.</li>
          <li><strong>Mensajes y comentarios de terceros:</strong> los que recibes en tus cuentas conectadas, que el servicio procesa para sugerirte o enviar respuestas y para detectar oportunidades comerciales. Cuando se detecta un lead, se guarda el mensaje y una puntuación de interés.</li>
          <li><strong>Sesión:</strong> una cookie técnica estrictamente necesaria (ver la <LegalLink href="/cookies">Política de Cookies</LegalLink>).</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="3. Finalidades y base jurídica">
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-slate-50 text-slate-900">
              <tr>
                <th className="px-4 py-3 font-semibold">Finalidad</th>
                <th className="px-4 py-3 font-semibold">Base jurídica</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 align-top">
              <tr>
                <td className="px-4 py-3">Gestión de tu cuenta y prestación del servicio (generar y publicar contenido, responder comentarios y mensajes, detectar leads, mostrar métricas)</td>
                <td className="px-4 py-3">Ejecución del contrato (art. 6.1.b RGPD)</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Cobro de la suscripción y facturación</td>
                <td className="px-4 py-3">Ejecución del contrato y cumplimiento de obligaciones legales (art. 6.1.b y 6.1.c RGPD)</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Envíos de servicio: resumen semanal, avisos de leads y restablecimiento de contraseña</td>
                <td className="px-4 py-3">Interés legítimo en informarte sobre el funcionamiento de tu cuenta (art. 6.1.f RGPD)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>No vendemos tus datos a terceros ni los usamos para publicidad ajena a SocialCors.</p>
      </LegalSection>

      <LegalSection title="4. Destinatarios y proveedores">
        <p>Compartimos datos únicamente con los proveedores necesarios para prestar el servicio:</p>
        <LegalList>
          <li><strong>Cloudflare</strong> — infraestructura y almacenamiento (bases de datos D1, almacenamiento de imágenes y vídeos R2 y caché KV) y modelos de IA de Workers AI (Llama, Mistral, LLaVA y SDXL), en la región del Espacio Económico Europeo.</li>
          <li><strong>Anthropic</strong> — IA conversacional (Claude), en EE. UU.</li>
          <li><strong>PiAPI, Apiframe y DashScope</strong> — generación de vídeo con IA.</li>
          <li><strong>Resend</strong> — envío de correos electrónicos de servicio.</li>
          <li><strong>Stripe</strong> — procesamiento de pagos.</li>
          <li><strong>Google</strong> — geocodificación de direcciones (Google Maps).</li>
          <li><strong>Plataformas que tú conectas</strong> (Meta, para Instagram y Facebook, y LinkedIn) — para publicar, leer comentarios y mensajes y consultar métricas en tu nombre, dentro de los permisos que apruebas al conectar tu cuenta.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="5. Redes sociales integradas">
        <LegalList>
          <li><strong>Instagram:</strong> integración activa.</li>
          <li><strong>LinkedIn:</strong> en desarrollo.</li>
          <li><strong>Facebook:</strong> preparada, pero no activa.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="6. Transferencias internacionales">
        <p>
          Los datos tratados por Anthropic (EE. UU.) constituyen una transferencia internacional, que se
          realiza con garantías adecuadas mediante cláusulas contractuales tipo (SCC) aprobadas por la
          Comisión Europea. Puedes solicitar más información sobre estas garantías en {mail}.
        </p>
      </LegalSection>

      <LegalSection title="7. Cuánto tiempo conservamos tus datos">
        <p>
          Conservamos tus datos mientras el contrato esté vigente y, una vez finalizado, durante 5 años los
          datos necesarios para atender obligaciones fiscales. Si desconectas tu cuenta de Instagram desde
          el panel de Instagram o Meta, invalidamos el token de acceso de inmediato. Si solicitas la
          eliminación de tus datos (sección 8), los borramos de forma permanente en un plazo razonable tras
          la solicitud, salvo los que debamos conservar por obligación legal.
        </p>
      </LegalSection>

      <LegalSection title="8. Cómo eliminar tus datos" id="eliminar-datos">
        <p>Puedes solicitar la eliminación de tus datos de dos formas:</p>
        <LegalList>
          <li>
            <strong>Desde Instagram o Facebook:</strong> en la configuración de tu cuenta de Meta, en la
            sección de aplicaciones conectadas, puedes solicitar que SocialCors elimine tus datos. Meta nos
            lo notifica automáticamente y procesamos la solicitud sin intervención manual; recibirás un
            enlace de confirmación donde podrás verificar que se completó.
          </li>
          <li><strong>Por correo electrónico:</strong> escribiendo a {mail} y solicitando la eliminación de tu cuenta y datos asociados.</li>
        </LegalList>
        <p>
          Al procesar una solicitud de eliminación vía Meta, borramos de forma permanente: la conexión con
          tu cuenta de Instagram (y su token), el historial de comentarios y mensajes gestionados a través
          de SocialCors y los leads derivados de esas conversaciones. El contenido que hayas creado con
          SocialCors (publicaciones, campañas) queda bajo tu control y no se elimina automáticamente por
          esta vía, ya que es contenido tuyo y no datos obtenidos a través de los permisos de Meta.
        </p>
      </LegalSection>

      <LegalSection title="9. Datos de terceros y encargado del tratamiento" id="terceros">
        <p>
          Cuando conectas tus redes sociales, SocialCors trata datos de tus seguidores y de tu audiencia
          (por ejemplo, sus comentarios y mensajes). En ese caso, <strong>SocialCors actúa como encargado
          del tratamiento</strong> y tú eres el responsable, conforme al{" "}
          <LegalLink href="/dpa">Acuerdo de Encargado del Tratamiento (DPA)</LegalLink>.
        </p>
        <p>
          Si subes fotos o datos de personas de tu equipo o de terceros, eres responsable de contar con la
          legitimación necesaria para hacerlo.
        </p>
      </LegalSection>

      <LegalSection title="10. Inteligencia artificial">
        <p>
          El contenido que subes y los mensajes y comentarios que recibes pueden ser procesados por
          proveedores de inteligencia artificial para generar contenido y respuestas. Este contenido no se
          utiliza para entrenar modelos propios de SocialCors.
        </p>
      </LegalSection>

      <LegalSection title="11. Tus derechos">
        <p>
          Tienes derecho a acceder a tus datos, rectificarlos, suprimirlos, limitar su tratamiento,
          oponerte a él y solicitar su portabilidad. Puedes ejercer estos derechos escribiendo a {mail},
          indicando el derecho que quieres ejercer y acompañando, si es necesario, un documento que
          acredite tu identidad.
        </p>
        <p>
          Si consideras que tus derechos no han sido atendidos, puedes presentar una reclamación ante la
          Agencia Española de Protección de Datos (AEPD):{" "}
          <LegalLink href="https://www.aepd.es">www.aepd.es</LegalLink>. Si resides en otro país de la
          Unión Europea, además de la AEPD puedes dirigirte a la autoridad de control de protección de
          datos de tu país de residencia; puedes encontrar la tuya en el{" "}
          <LegalLink href={EDPB_MEMBERS_URL}>directorio de autoridades del Comité Europeo de Protección de Datos</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="12. Cambios en esta política">
        <p>
          Podemos actualizar esta política cuando cambien las funciones del servicio o los requisitos
          legales aplicables. La fecha de la última actualización figura al principio de esta página.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
