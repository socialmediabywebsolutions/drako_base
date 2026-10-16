/**
 * Página diagnóstico mínima — sin dependencias del monolito.
 * Solo usa Next.js + React. Si esto falla → problema de SSR/infraestructura CF/OpenNext.
 */
export const dynamic = "force-dynamic";

export default function PingPage() {
  return <p>ok</p>;
}
