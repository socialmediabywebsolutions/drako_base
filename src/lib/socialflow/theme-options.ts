// Selector de tema compartido por los 4 formatos de publicación (Post, Reel, Historia,
// Carrusel) — antes vivía duplicado solo en publish-carrusel.tsx. `value` es la clave
// interna del chip seleccionado, `sendValue` es lo que viaja en el body de
// generate-from-image como `carouselTheme` ("auto" es el centinela que el backend
// interpreta como "sin tema explícito", ver CarouselComposerAgent.run y
// generate-from-image/route.ts).
export type ContentTheme = "entrenamiento" | "nutricion" | "motivacion" | "educativo" | "lifestyle" | "auto";

export const THEME_OPTIONS: { value: ContentTheme; label: string; sendValue: string }[] = [
  { value: "entrenamiento", label: "🏋️ Entrenamiento", sendValue: "Entrenamiento" },
  { value: "nutricion", label: "🥗 Nutrición y recetas", sendValue: "Nutrición y recetas" },
  { value: "motivacion", label: "💪 Motivación", sendValue: "Motivación" },
  { value: "educativo", label: "📚 Educativo / Tips", sendValue: "Educativo / Tips" },
  { value: "lifestyle", label: "✨ Lifestyle", sendValue: "Lifestyle" },
  { value: "auto", label: "🎯 Lo que decida la IA", sendValue: "auto" },
];
