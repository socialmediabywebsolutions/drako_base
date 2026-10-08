// Lightweight XLSX text extractor — zero dependencies, edge-safe.
// Replaces jszip (97 KB) with an inline minimal ZIP reader that uses
// DecompressionStream (Web Streams API built into Cloudflare Workers / modern browsers).
// Only the first worksheet is processed — product catalogs are expected to be single-sheet.

import { rowsToKnowledgeText } from "./catalog-format";

// ── Minimal ZIP reader ────────────────────────────────────────────────────────

function u16le(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}
function u32le(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  await writer.write(data);
  await writer.close();

  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as Uint8Array);
  }

  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

async function extractFromZip(bytes: ArrayBuffer, targetPath: string): Promise<string | null> {
  const view = new DataView(bytes);
  const u8 = new Uint8Array(bytes);

  // Find End of Central Directory (EOCD) — signature 0x06054b50 — search backwards
  let eocd = -1;
  for (let i = bytes.byteLength - 22; i >= 0; i--) {
    if (u32le(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return null;

  const cdOffset = u32le(view, eocd + 16);
  const cdSize = u32le(view, eocd + 12);

  // Walk central directory
  let cdPos = cdOffset;
  const decoder = new TextDecoder();
  while (cdPos < cdOffset + cdSize && cdPos + 46 <= bytes.byteLength) {
    if (u32le(view, cdPos) !== 0x02014b50) break; // central file header signature

    const fnLen = u16le(view, cdPos + 28);
    const extraLen = u16le(view, cdPos + 30);
    const commentLen = u16le(view, cdPos + 32);
    const localHeaderOff = u32le(view, cdPos + 42);
    const fileName = decoder.decode(u8.slice(cdPos + 46, cdPos + 46 + fnLen));

    if (fileName === targetPath) {
      // Read local file header
      const method = u16le(view, localHeaderOff + 8);
      const compressedSize = u32le(view, localHeaderOff + 18);
      const localFnLen = u16le(view, localHeaderOff + 26);
      const localExtraLen = u16le(view, localHeaderOff + 28);
      const dataStart = localHeaderOff + 30 + localFnLen + localExtraLen;
      const compressed = u8.slice(dataStart, dataStart + compressedSize);

      let raw: Uint8Array;
      if (method === 0) {
        raw = compressed; // stored — no compression
      } else if (method === 8) {
        raw = await inflateRaw(compressed); // deflate
      } else {
        return null; // unsupported compression
      }

      return decoder.decode(raw);
    }

    cdPos += 46 + fnLen + extraLen + commentLen;
  }

  return null;
}

// ── XML helpers (unchanged from original jszip version) ──────────────────────

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function columnLetterToIndex(letter: string): number {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index - 1;
}

function parseSharedStrings(xml: string): string[] {
  const items: string[] = [];
  const siPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;
  while ((match = siPattern.exec(xml)) !== null) {
    const texts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXmlEntities(m[1]));
    items.push(texts.join(""));
  }
  return items;
}

function parseSheetRows(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(xml)) !== null) {
    const sparse: string[] = [];
    const cellPattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      const attrs = cellMatch[1];
      const inner = cellMatch[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+)\d+"/);
      if (!ref) continue;
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const colIndex = columnLetterToIndex(ref[1]);

      let value = "";
      if (type === "s") {
        const idx = parseInt(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "", 10);
        value = Number.isFinite(idx) ? (sharedStrings[idx] ?? "") : "";
      } else if (type === "inlineStr") {
        value = decodeXmlEntities(inner.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "");
      } else {
        value = decodeXmlEntities(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "");
      }
      sparse[colIndex] = value;
    }

    rows.push(Array.from({ length: sparse.length }, (_, i) => sparse[i] ?? ""));
  }

  return rows;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function extractTextFromXlsx(bytes: ArrayBuffer): Promise<string> {
  const [sharedStringsXml, sheetXml] = await Promise.all([
    extractFromZip(bytes, "xl/sharedStrings.xml"),
    extractFromZip(bytes, "xl/worksheets/sheet1.xml"),
  ]);

  if (!sheetXml) return "";
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : [];
  const rows = parseSheetRows(sheetXml, sharedStrings);
  return rowsToKnowledgeText(rows);
}
