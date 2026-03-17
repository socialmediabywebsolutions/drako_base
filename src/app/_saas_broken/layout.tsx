import { notFound } from "next/navigation";

export default function LegacySaasBrokenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  void children;
  notFound();
}
