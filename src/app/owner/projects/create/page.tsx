import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function OwnerProjectCreatePage() {
  redirect("/operator/projects/create");
}
