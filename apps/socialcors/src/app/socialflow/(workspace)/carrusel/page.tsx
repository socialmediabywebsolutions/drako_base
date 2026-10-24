import { redirect } from "next/navigation";

// Ruta legacy — el selector de carrusel ahora vive en /socialflow/carrusel/subir.
export default function SocialFlowCarruselRedirect() {
  redirect("/socialflow/carrusel/subir");
}
