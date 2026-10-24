import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Acceso — Drako",
  robots: { index: false, follow: false },
};

export default function OperatorLoginLayout({ children }: { children: ReactNode }) {
  return children;
}
