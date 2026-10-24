import type { ReactNode } from "react";
import ControlPlaneLayout from "@/components/layouts/control-plane-layout";

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <ControlPlaneLayout>{children}</ControlPlaneLayout>;
}
