import { LegalLayout, LegalLink, LegalList, LegalSection } from "@/components/legal/legal-layout";
import { LEGAL_HOLDER } from "@/components/legal/legal-data";

export const dynamic = "force-static";

export const metadata = {
  title: "Acuerdo de Encargado del Tratamiento (DPA) — SocialCors",
  description: "Acuerdo de encargado del tratamiento (art. 28 RGPD) aplicable cuando SocialCors trata datos personales de terceros por cuenta del cliente.",
};

export default function DpaPage() {
  return (
    <LegalLayout
      title="Acuerdo de Encargado del Tratamiento (DPA)"
      intro={
        <p>
          Este acuerdo regula el tratamiento de datos personales que SocialCors realiza por cuenta de sus
          clientes, conforme al artículo 28 del Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018
          (LOPDGDD). Forma parte de los <LegalLink href="/terminos">Términos y Condiciones</LegalLink> y se
          entiende aceptado al crear la cuenta.
        </p>
      }
    >
      <LegalSection title="1. Objeto y partes">
        <p>
          SocialCors actúa como <strong>encargado del tratamiento</strong> cuando procesa datos personales
          de los seguidores, clientes o audiencia del usuario a través de las redes sociales conectadas.
        </p>
        <LegalList>
          <li><strong>Responsable del tratamiento:</strong> el cliente de SocialCors (la persona o empresa que contrata el servicio y conecta sus redes sociales).</li>
          <li><strong>Encargado del tratamiento:</strong> {LEGAL_HOLDER.name} (SocialCors), DNI {LEGAL_HOLDER.dni}, {LEGAL_HOLDER.address}, <LegalLink href={`mailto:${LEGAL_HOLDER.email}`}>{LEGAL_HOLDER.email}</LegalLink>.</li>
        </LegalList>
        <p>
          Respecto a los datos de la cuenta del propio cliente (identificación, facturación, acceso), el
          responsable es SocialCors, según se describe en la{" "}
          <LegalLink href="/privacidad">Política de Privacidad</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="2. Datos tratados y finalidad">
        <p>Datos tratados por cuenta del cliente:</p>
        <LegalList>
          <li>Mensajes y comentarios recibidos en las redes sociales conectadas.</li>
          <li>Leads derivados de esas conversaciones (mensaje y puntuación de interés).</li>
          <li>Datos de audiencia de las redes conectadas (por ejemplo, identificadores y nombres de usuario de quienes interactúan, y métricas).</li>
        </LegalList>
        <p>
          <strong>Finalidad:</strong> la prestación del servicio de automatización contratado (sugerir o
          enviar respuestas, detectar oportunidades comerciales y mostrar métricas). Los interesados son las
          personas que interactúan con las cuentas del cliente.
        </p>
      </LegalSection>

      <LegalSection title="3. Obligaciones del encargado">
        <p>SocialCors se compromete a:</p>
        <LegalList>
          <li>Tratar los datos únicamente siguiendo las instrucciones documentadas del cliente, que se concretan en el uso y la configuración del servicio, y no utilizarlos para fines propios.</li>
          <li>Garantizar la confidencialidad de las personas autorizadas a tratar los datos.</li>
          <li>Aplicar medidas técnicas y organizativas de seguridad adecuadas al riesgo.</li>
          <li>Asistir al cliente, en la medida de lo posible, para atender el ejercicio de derechos de los interesados.</li>
          <li>Notificar al cliente sin dilación indebida las violaciones de seguridad de los datos de las que tenga conocimiento.</li>
          <li>Suprimir o devolver los datos al finalizar el contrato de servicio, salvo que una norma obligue a conservarlos.</li>
          <li>Poner a disposición del cliente la información necesaria para demostrar el cumplimiento de estas obligaciones.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="4. Subencargados">
        <p>El cliente autoriza a SocialCors a recurrir a los siguientes subencargados:</p>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <thead className="bg-slate-50 text-slate-900">
              <tr>
                <th className="px-4 py-3 font-semibold">Subencargado</th>
                <th className="px-4 py-3 font-semibold">Servicio</th>
                <th className="px-4 py-3 font-semibold">Ubicación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="px-4 py-3">Cloudflare</td>
                <td className="px-4 py-3">Infraestructura, almacenamiento (D1, R2, KV) e IA (Workers AI)</td>
                <td className="px-4 py-3">Espacio Económico Europeo</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Anthropic</td>
                <td className="px-4 py-3">IA conversacional</td>
                <td className="px-4 py-3">EE. UU. (transferencia internacional)</td>
              </tr>
              <tr>
                <td className="px-4 py-3">Resend</td>
                <td className="px-4 py-3">Envío de correos electrónicos (por ejemplo, avisos de leads)</td>
                <td className="px-4 py-3">Disponible bajo petición en {LEGAL_HOLDER.email}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          SocialCors podrá actualizar esta lista. Los cambios se comunicarán al cliente con antelación
          razonable, y el cliente podrá oponerse por motivos fundados escribiendo a{" "}
          {LEGAL_HOLDER.email} o, en su defecto, cancelar el servicio. SocialCors impone a los subencargados
          obligaciones equivalentes a las de este acuerdo.
        </p>
      </LegalSection>

      <LegalSection title="5. Transferencias internacionales">
        <p>
          Las transferencias internacionales de datos se rigen por lo indicado en la{" "}
          <LegalLink href="/privacidad">Política de Privacidad</LegalLink>. En particular, los datos
          tratados por Anthropic (EE. UU.) se transfieren con garantías adecuadas, mediante cláusulas
          contractuales tipo.
        </p>
      </LegalSection>

      <LegalSection title="6. Derechos de auditoría">
        <p>
          El cliente puede solicitar información y, con preaviso razonable y sin perturbar el servicio,
          verificaciones razonables de que SocialCors cumple este acuerdo. Las solicitudes se dirigirán a{" "}
          <LegalLink href={`mailto:${LEGAL_HOLDER.email}`}>{LEGAL_HOLDER.email}</LegalLink>.
        </p>
      </LegalSection>

      <LegalSection title="7. Vigencia">
        <p>
          Este acuerdo permanece vigente mientras dure el contrato de servicio. Al finalizar, SocialCors
          suprimirá o devolverá los datos conforme a la sección 3.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
