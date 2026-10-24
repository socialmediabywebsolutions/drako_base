// Lightweight EXIF GPS extractor — zero dependencies, edge-safe.
// Replaces exifr (75 KB) to keep the Cloudflare Worker under the 64 MiB limit.
// Only extracts GPS latitude/longitude from JPEG EXIF headers.
// Non-JPEG files, images without GPS, and malformed EXIF return null without throwing.

function readRational(view: DataView, offset: number, le: boolean): number {
  const num = le ? view.getUint32(offset, true) : view.getUint32(offset, false);
  const den = le ? view.getUint32(offset + 4, true) : view.getUint32(offset + 4, false);
  return den === 0 ? 0 : num / den;
}

function parseDMS(view: DataView, offset: number, le: boolean): number {
  const deg = readRational(view, offset, le);
  const min = readRational(view, offset + 8, le);
  const sec = readRational(view, offset + 16, le);
  return deg + min / 60 + sec / 3600;
}

function parseGpsIfd(view: DataView, ifdOffset: number, le: boolean, tiffBase: number): { lat: number; lng: number } | null {
  const count = le ? view.getUint16(ifdOffset, true) : view.getUint16(ifdOffset, false);
  let latRef: string | null = null;
  let lngRef: string | null = null;
  let latVal: number | null = null;
  let lngVal: number | null = null;

  for (let i = 0; i < count; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;
    const tag = le ? view.getUint16(entryOffset, true) : view.getUint16(entryOffset, false);
    const valueOffset = le ? view.getUint32(entryOffset + 8, true) : view.getUint32(entryOffset + 8, false);

    if (tag === 0x0001) {
      // GPSLatitudeRef — ASCII char
      latRef = String.fromCharCode(view.getUint8(entryOffset + 8));
    } else if (tag === 0x0003) {
      // GPSLongitudeRef — ASCII char
      lngRef = String.fromCharCode(view.getUint8(entryOffset + 8));
    } else if (tag === 0x0002) {
      // GPSLatitude — 3 rationals
      const abs = tiffBase + valueOffset;
      if (abs + 24 <= view.byteLength) latVal = parseDMS(view, abs, le);
    } else if (tag === 0x0004) {
      // GPSLongitude — 3 rationals
      const abs = tiffBase + valueOffset;
      if (abs + 24 <= view.byteLength) lngVal = parseDMS(view, abs, le);
    }
  }

  if (latVal === null || lngVal === null) return null;
  return {
    lat: latRef === "S" ? -latVal : latVal,
    lng: lngRef === "W" ? -lngVal : lngVal,
  };
}

function extractGps(buffer: ArrayBuffer): { lat: number; lng: number } | null {
  if (buffer.byteLength < 12) return null;
  const view = new DataView(buffer);

  // Must be JPEG (FF D8)
  if (view.getUint16(0, false) !== 0xffd8) return null;

  // Walk JPEG segments to find APP1 (FF E1)
  let pos = 2;
  while (pos + 4 <= buffer.byteLength) {
    const marker = view.getUint16(pos, false);
    const segLen = view.getUint16(pos + 2, false);

    if (marker === 0xffe1) {
      // APP1 — check for "Exif\0\0"
      const exifPos = pos + 4;
      if (exifPos + 6 <= buffer.byteLength) {
        const magic = new Uint8Array(buffer, exifPos, 6);
        if (magic[0] === 0x45 && magic[1] === 0x78 && magic[2] === 0x69 && magic[3] === 0x66 && magic[4] === 0x00 && magic[5] === 0x00) {
          // TIFF header starts at exifPos + 6
          const tiffBase = exifPos + 6;
          if (tiffBase + 8 > buffer.byteLength) return null;

          const byteOrder = view.getUint16(tiffBase, false);
          const le = byteOrder === 0x4949; // "II" = little-endian

          const ifd0Offset = le ? view.getUint32(tiffBase + 4, true) : view.getUint32(tiffBase + 4, false);
          const ifd0Pos = tiffBase + ifd0Offset;
          if (ifd0Pos + 2 > buffer.byteLength) return null;

          const ifd0Count = le ? view.getUint16(ifd0Pos, true) : view.getUint16(ifd0Pos, false);
          for (let i = 0; i < ifd0Count; i++) {
            const entryOffset = ifd0Pos + 2 + i * 12;
            if (entryOffset + 12 > buffer.byteLength) break;
            const tag = le ? view.getUint16(entryOffset, true) : view.getUint16(entryOffset, false);
            if (tag === 0x8825) {
              // GPSInfo IFD pointer
              const gpsIfdOffset = le ? view.getUint32(entryOffset + 8, true) : view.getUint32(entryOffset + 8, false);
              const gpsIfdPos = tiffBase + gpsIfdOffset;
              if (gpsIfdPos + 2 <= buffer.byteLength) {
                return parseGpsIfd(view, gpsIfdPos, le, tiffBase);
              }
            }
          }
          return null; // APP1 found but no GPS IFD
        }
      }
    }

    if (marker === 0xffda) break; // SOS — start of scan, no more metadata after this
    pos += 2 + segLen;
  }

  return null;
}

// exifr.gps() ya devuelve undefined (sin lanzar) cuando la imagen no tiene tags GPS.
// El try/catch de aquí cubre fallos reales: buffer que no es una imagen válida,
// formato no soportado, EXIF corrupto. Nunca debe tumbar el flujo de subida de foto —
// ver Sprint I (geolocalización narrativa): si no hay coordenadas, el caption sigue siendo
// el genérico de siempre, no un error.
export async function extractGpsFromBuffer(buffer: ArrayBuffer): Promise<{ lat: number; lng: number } | null> {
  try {
    return extractGps(buffer);
  } catch (error) {
    console.error("[exif] extractGpsFromBuffer failed", error instanceof Error ? error.message : String(error));
    return null;
  }
}
