export const runtime = "edge";

import dynamic from "next/dynamic";

const SaasDetailClient = dynamic(() => import("./SaasDetailClient"), {
  ssr: false,
});

export default function SaasDetailPage() {
  return <SaasDetailClient />;
}
