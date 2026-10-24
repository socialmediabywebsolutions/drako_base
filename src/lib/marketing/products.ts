export type ProductStatus = "live" | "building" | "research";

export type Product = {
  slug: string;
  name: string;
  status: ProductStatus;
  shortDescription: string;
  longDescription?: string;
  track?: string;
  websiteUrl?: string;
  isPublic?: boolean;
  highlighted?: boolean;
};

export const products: Product[] = [
  {
    slug: "socialflow",
    name: "Socialcors",
    status: "live",
    shortDescription: "Reduce tiempo manual en marketing: publicaciones y respuestas se mantienen al día con soporte de IA.",
    longDescription:
      "Producto enfocado en equipos de marketing que pierden horas coordinando publicaciones y respuestas. Socialcors mantiene el calendario, responde con contexto y entrega reportes consistentes para mejorar resultados sin esfuerzo extra.",
    track: "automation",
    isPublic: true,
    highlighted: true,
  },
];
