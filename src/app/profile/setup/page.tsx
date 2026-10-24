import { redirect } from "next/navigation";

export default function ProfileSetupLegacyRedirect() {
  redirect("/socialflow/setup");
}
