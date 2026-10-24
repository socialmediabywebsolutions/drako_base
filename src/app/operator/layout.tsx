import type { ReactNode } from "react";
import ControlPlaneLayout from "@/components/layouts/control-plane-layout";

export default function OperatorLayout({ children }: { children: ReactNode }) {
  return <ControlPlaneLayout>{children}</ControlPlaneLayout>;
}
