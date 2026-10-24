import { LegalLayout, LegalLink, LegalList, LegalSection } from "@/components/legal/legal-layout";
import { LEGAL_HOLDER } from "@/components/legal/legal-data";

export const dynamic = "force-static";

export const metadata = {
  title: "Política de Cookies — SocialCors",
  description: "Qué cookies utiliza SocialCors: solo una cookie técnica de sesión, estrictamente necesaria.",
};

export default function CookiesPage() {
  return (
    <LegalLayout
      title="Política de Cookies"
      intro={<p>Esta política explica qué cookies utiliza SocialCors y con qué finalidad.</p>}
    >
      <LegalSection title="1. Qué son las cookies">
        <p>
          Las cookies son pequeños archivos que un sitio web guarda en tu navegador para recordar
          información, por ejemplo, que has iniciado sesión. Pueden ser propias (las instala el sitio que
          visitas) o de terceros (las instala otra entidad), y pueden ser técnicas, de personalización, de
          analítica o de publicidad.
        </p>
      </LegalSection>

      <LegalSection title="2. Cookies que utiliza SocialCors">
        <p>SocialCors utiliza únicamente la siguiente cookie:</p>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-slate-50 text-slate-900">
              <tr>
                <th className="px-4 py-3 font-semibold">Cookie</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Titular</th>
                <th className="px-4 py-3 font-semibold">Duración</th>
                <th className="px-4 py-3 font-semibold">Finalidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="px-4 py-3 font-mono text-xs">__Host-socialflow_session</td>
                <td className="px-4 py-3">Técnica, estrictamente necesaria</td>
                <td className="px-4 py-3">Propia</td>
                <td className="px-4 py-3">8 horas</td>
                <td className="px-4 py-3">Autenticación: mantiene tu sesión iniciada</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Esta cookie se instala únicamente cuando creas una cuenta o inicias sesión. Es <em>httpOnly</em>{" "}
          (no es accesible desde scripts), <em>secure</em> (solo se transmite por conexión cifrada) y tiene
          el atributo <em>SameSite=Lax</em>.
        </p>
      </LegalSection>

      <LegalSection title="3. Lo que no utilizamos">
        <p>
          SocialCors <strong>no utiliza cookies de analítica, de publicidad ni de terceros</strong> para los
          visitantes que no han iniciado sesión. Tampoco utilizamos herramientas de analítica ni píxeles de
          seguimiento.
        </p>
      </LegalSection>

      <LegalSection title="4. Sin banner de cookies">
        <p>
          Como la única cookie utilizada es técnica y estrictamente necesaria para prestar el servicio que
          solicitas (mantener tu sesión), está exenta del deber de obtener tu consentimiento conforme al
          artículo 22.2 de la LSSI-CE. Por eso este sitio no muestra un banner de cookies. Si en el futuro
          se incorporasen cookies que requieran consentimiento, se actualizará esta política y se
          solicitará tu consentimiento antes de instalarlas.
        </p>
      </LegalSection>

      <LegalSection title="5. Cómo gestionar las cookies desde tu navegador">
        <p>
          Puedes permitir, bloquear o eliminar las cookies desde la configuración de tu navegador (Chrome,
          Firefox, Safari, Edge u otros). Ten en cuenta que si bloqueas o eliminas la cookie de sesión no
          podrás mantener la sesión iniciada en SocialCors y tendrás que volver a identificarte.
        </p>
        <LegalList>
          <li>Busca el apartado «Privacidad» o «Cookies» en los ajustes de tu navegador.</li>
          <li>Elimina las cookies del sitio socialcors.com para cerrar la sesión en ese navegador.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="6. Más información">
        <p>
          El tratamiento de tus datos personales se describe en la{" "}
          <LegalLink href="/privacidad">Política de Privacidad</LegalLink>. Para cualquier duda sobre
          esta política puedes escribir a{" "}
          <LegalLink href={`mailto:${LEGAL_HOLDER.email}`}>{LEGAL_HOLDER.email}</LegalLink>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
