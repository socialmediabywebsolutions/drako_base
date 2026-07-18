import { redirect } from "next/navigation";

// Ruta legacy — el selector de formato ahora vive en /socialflow/publicar (tarjetas).
export default function SocialFlowPublicarHistoriaRedirect() {
  redirect("/socialflow/publicar");
}
