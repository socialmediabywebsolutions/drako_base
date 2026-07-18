import { redirect } from "next/navigation";

// Ruta legacy — el selector de formato ahora vive en /socialflow/publicar (tarjetas).
export default function SocialFlowPublicarPostRedirect() {
  redirect("/socialflow/publicar");
}
