import type { ReactNode } from "react";
import ControlPlaneLayout from "@/components/layouts/control-plane-layout";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <ControlPlaneLayout>{children}</ControlPlaneLayout>;
}
