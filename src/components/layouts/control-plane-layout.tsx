import type { ReactNode } from "react";
import HostSwitcher from "@/components/dev/HostSwitcher";
import ShellLayout from "@/components/layouts/shell-layout";

export default function ControlPlaneLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ShellLayout>{children}</ShellLayout>
      <HostSwitcher />
    </>
  );
}
