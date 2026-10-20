/**
 * Enrutador de homepage por host — un solo worker, dos dominios.
 *
 * drako.systems     → landing del SaaS community manager (componentes /socialflows)
 * socialcors.com    → hub de los SaaS sociales del ecosistema Drako
 *
 * Arquitectura de dominios:
 *  - drako.systems           → SaaS community manager (este worker, ruta raíz)
 *  - crypto.drako.systems    → Crypto IA (futuro)
 *  - cazh.drako.systems      → Cazh (futuro)
 *  - socialcors.com          → casa central SaaS sociales (este worker, ruta raíz)
 *  - mentoria.socialcors.com → Mentoría IA (futuro)
 *  - cadul.socialcors.com    → Cadul (futuro)
 */

import { headers } from "next/headers";
import SocialFlowsLanding from "./socialflows/page";
import SocialCorsHub from "./_hub/page";

export default async function RootPage() {
  const hdrs = await headers();
  const host =
    hdrs.get("x-drako-effective-host") ??
    hdrs.get("host") ??
    "";

  // drako.systems y sus previews → landing del SaaS community manager
  if (
    host === "drako.systems" ||
    host.endsWith(".drako.systems") && !host.startsWith("bases.") && !host.startsWith("base.") && !host.startsWith("admin.") && !host.startsWith("socialcors.")
  ) {
    return <SocialFlowsLanding />;
  }

  // socialcors.com y cualquier otro → hub de los SaaS sociales
  return <SocialCorsHub />;
}
