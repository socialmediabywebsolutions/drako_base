// Extrae solo la sección de voz real del cliente (VoiceExtractionAgent, ver Sprint B)
// del bloque de Knowledge Base que buildProfile() ya embebe en BrandProfile.longDescription
// — getKnowledgeContext() separa cada sección con "\n\n===\n\n" (ver knowledge/repository.ts),
// así que ese separador es el delimitador real de fin de sección, no un heurístico de
// caracteres como el kbExtract genérico de CarouselComposerAgent. Reutilizable por
// cualquier agente que genere texto de cara al cliente y necesite solo esta sección,
// sin arrastrar market_analysis/competitor/catalog en el mismo extracto.
const VOICE_SECTION_MARKER = "## VOZ REAL DEL CLIENTE (extraída de sus propios posts publicados)";
const SECTION_SEPARATOR = "\n\n===\n\n";
const VOICE_SECTION_MAX_CHARS = 1200;

export function extractVoiceSection(longDescription: string): string {
  const start = longDescription.indexOf(VOICE_SECTION_MARKER);
  if (start === -1) return "";
  const afterMarker = longDescription.slice(start + VOICE_SECTION_MARKER.length);
  const end = afterMarker.indexOf(SECTION_SEPARATOR);
  const section = end === -1 ? afterMarker : afterMarker.slice(0, end);
  return section.trim().slice(0, VOICE_SECTION_MAX_CHARS);
}
