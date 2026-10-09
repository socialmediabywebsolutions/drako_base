import { Suspense } from "react";
import PlanesClient from "./_components/planes-client";

function PlanesFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#F7F6FA" }} />
  );
}

export default function SocialFlowPlanesPage() {
  return (
    <Suspense fallback={<PlanesFallback />}>
      <PlanesClient />
    </Suspense>
  );
}
