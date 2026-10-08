import { gps } from "exifr";

// exifr.gps() ya devuelve undefined (sin lanzar) cuando la imagen no tiene tags GPS —
// ver node_modules/exifr/src/highlevel/gps.mjs. El try/catch de aquí cubre el resto de
// fallos reales que SÍ pueden lanzar: buffer que no es una imagen válida, formato no
// soportado, EXIF corrupto. Nunca debe tumbar el flujo de subida de foto — ver
// Sprint I (geolocalización narrativa): si no hay coordenadas, el caption sigue siendo
// el genérico de siempre, no un error.
export async function extractGpsFromBuffer(buffer: ArrayBuffer): Promise<{ lat: number; lng: number } | null> {
  try {
    const result = await gps(buffer);
    if (!result || typeof result.latitude !== "number" || typeof result.longitude !== "number") {
      return null;
    }
    return { lat: result.latitude, lng: result.longitude };
  } catch (error) {
    console.error("[exif] extractGpsFromBuffer failed", error instanceof Error ? error.message : String(error));
    return null;
  }
}
