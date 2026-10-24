import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function OwnerProjectsPage() {
  redirect("/operator/projects");
}
