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
    name: "SocialFlow",
    status: "live",
    shortDescription: "Automatización de redes sociales operada por agentes con flujos supervisados.",
    longDescription:
      "SaaS de automatización de contenido y gestión en redes, ejecutado por agentes con playbooks, gobernanza y observabilidad integradas.",
    track: "automation",
    isPublic: true,
    highlighted: true,
  },
];
