import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveHostMode } from "@/lib/hosts";

export default async function Home() {
  const headersList = await headers();
  const host = headersList.get("x-drako-effective-host") ?? headersList.get("host") ?? "";
  const mode = resolveHostMode(host);

  if (mode === "CAMPAMENTO_BASE") redirect("/admin");
  if (mode === "PREVIEW") redirect("/preview");

  redirect("/site");
}
