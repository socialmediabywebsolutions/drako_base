export const dynamic = "force-static";

export const metadata = {
  title: "Política de Privacidad — Socialcors",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-black text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-400">Socialcors</p>
      <h1 className="mt-3 text-3xl font-black text-slate-900">Política de Privacidad</h1>
      <p className="mt-2 text-sm text-slate-500">Última actualización: 25 de agosto de 2026.</p>

      <p className="mt-6 text-sm leading-relaxed text-slate-600">
        Socialcors es un servicio de gestión y automatización de redes sociales con inteligencia
        artificial, dirigido a influencers y empresas, que analiza fotos y contexto de marca para
        generar contenido, publicarlo en Instagram y LinkedIn en el momento óptimo, responder
        comentarios y mensajes directos, y detectar oportunidades de venta (leads) en las
        conversaciones entrantes. Esta política explica qué datos recopilamos para prestar ese
        servicio, cómo los usamos, dónde se almacenan y cómo puedes solicitar su eliminación.
      </p>

      <Section title="1. Quién trata tus datos">
        <p>
          Socialcors es un producto operado por Drako Systems. Para cualquier consulta sobre esta
          política o para ejercer tus derechos de datos, puedes escribirnos a{" "}
          <a href="mailto:privacidad@socialcors.com" className="underline">
            privacidad@socialcors.com
          </a>
          .
        </p>
      </Section>

      <Section title="2. Qué datos recopilamos">
        <p>Dependiendo de qué funciones de Socialcors uses, recopilamos:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Tokens de acceso OAuth de Instagram y LinkedIn</strong>, obtenidos cuando conectas
            tu cuenta voluntariamente — nos permiten publicar contenido, leer comentarios/mensajes y
            consultar métricas en tu nombre, dentro de los permisos que apruebas explícitamente en
            ese momento.
          </li>
          <li>
            <strong>Comentarios y mensajes directos (DM)</strong> recibidos en tus publicaciones de
            Instagram, leídos vía la API oficial de Meta, para poder sugerirte o enviar respuestas
            automáticas.
          </li>
          <li>
            <strong>Métricas e insights</strong> de tus publicaciones (alcance, interacciones,
            impresiones) obtenidos vía la API de Meta.
          </li>
          <li>
            <strong>Leads</strong>: cuando detectamos que un comentario o mensaje muestra intención de
            compra (por ejemplo, una pregunta de precio), guardamos ese mensaje y una puntuación de
            interés para ayudarte a priorizar tu atención comercial.
          </li>
          <li>
            <strong>Fotos que subes</strong> para que la IA genere contenido (posts, reels, carruseles)
            a partir de ellas.
          </li>
          <li>
            <strong>Datos de tu marca/negocio</strong> que nos proporcionas en el onboarding (nombre,
            descripción, tono de voz, público objetivo) para que el contenido generado sea coherente
            con tu identidad.
          </li>
          <li>
            <strong>Datos de cuenta y facturación</strong> (email, datos de pago procesados por
            Stripe — nunca almacenamos números de tarjeta directamente).
          </li>
        </ul>
      </Section>

      <Section title="3. Cómo usamos tus datos">
        <ul className="list-disc space-y-1 pl-5">
          <li>Generar y publicar contenido (texto, imagen y vídeo) en tu nombre, en los horarios que configures o que la IA recomiende.</li>
          <li>Responder comentarios y mensajes directos de forma automática o asistida, usando el conocimiento de tu marca.</li>
          <li>Detectar y priorizar oportunidades de venta (leads) en tus conversaciones entrantes.</li>
          <li>Mostrarte métricas y analítica de rendimiento de tus publicaciones.</li>
          <li>Mejorar el contenido futuro en función de qué formatos y horarios funcionan mejor para tu audiencia.</li>
        </ul>
        <p>No vendemos tus datos a terceros ni los usamos para publicidad ajena a Socialcors.</p>
      </Section>

      <Section title="4. Dónde y cómo se almacenan">
        <p>
          Tus datos se almacenan en bases de datos de Cloudflare (Cloudflare D1), dentro de la
          infraestructura sobre la que corre Socialcors. Los tokens de acceso a Instagram y LinkedIn
          se cifran (AES-GCM) antes de guardarse — nunca se almacenan en texto plano.
        </p>
      </Section>

      <Section title="5. Con quién compartimos datos">
        <p>
          Compartimos datos únicamente con los proveedores necesarios para prestar el servicio:
          Meta (API de Instagram/Facebook, para publicar y leer comentarios/mensajes en tu nombre),
          LinkedIn (misma finalidad para esa red), Cloudflare (infraestructura y almacenamiento), y
          Stripe (procesamiento de pagos). Ninguno de ellos usa tus datos para fines propios ajenos a
          la prestación de estos servicios.
        </p>
      </Section>

      <Section title="6. Cuánto tiempo conservamos tus datos">
        <p>
          Conservamos tus datos mientras tu cuenta esté activa y sea necesario para prestarte el
          servicio. Si desconectas tu cuenta de Instagram desde el propio panel de Instagram/Meta,
          invalidamos el token de acceso inmediatamente. Si solicitas la eliminación de tus datos
          (ver sección 7), los borramos de forma permanente en un plazo razonable tras la solicitud.
        </p>
      </Section>

      <Section title="7. Cómo eliminar tus datos">
        <p>Tienes dos formas de solicitar la eliminación de tus datos:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Desde Instagram/Facebook</strong>: en la configuración de tu cuenta de Meta, en la
            sección de aplicaciones conectadas, puedes solicitar directamente que Socialcors elimine
            tus datos. Meta nos notifica automáticamente y procesamos la solicitud sin intervención
            manual — recibirás un enlace de confirmación donde podrás verificar que se completó.
          </li>
          <li>
            <strong>Por email</strong>: escribiendo a{" "}
            <a href="mailto:privacidad@socialcors.com" className="underline">
              privacidad@socialcors.com
            </a>{" "}
            solicitando la eliminación de tu cuenta y datos asociados.
          </li>
        </ul>
        <p>
          Cuando procesamos una solicitud de eliminación, borramos permanentemente: la conexión con
          tu cuenta de Instagram (y su token), el historial de comentarios/mensajes gestionados a
          través de Socialcors, y los leads derivados de esas conversaciones. El contenido que hayas
          creado con Socialcors (posts, campañas) queda bajo tu control y no se elimina
          automáticamente por esta vía, ya que es contenido tuyo, no datos obtenidos a través de los
          permisos de Meta.
        </p>
      </Section>

      <Section title="8. Tus derechos">
        <p>
          De acuerdo con el Reglamento General de Protección de Datos (RGPD) y normativa aplicable,
          tienes derecho a acceder, rectificar, eliminar, limitar el tratamiento, oponerte al mismo,
          y solicitar la portabilidad de tus datos. Puedes ejercer cualquiera de estos derechos
          escribiendo a{" "}
          <a href="mailto:privacidad@socialcors.com" className="underline">
            privacidad@socialcors.com
          </a>
          .
        </p>
      </Section>

      <Section title="9. Cambios en esta política">
        <p>
          Podemos actualizar esta política cuando cambien las funciones del producto o los
          requisitos legales aplicables. La fecha de la última actualización aparece al principio de
          esta página.
        </p>
      </Section>
    </main>
  );
}
