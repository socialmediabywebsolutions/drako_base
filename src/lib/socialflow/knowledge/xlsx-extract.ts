// Lightweight XLSX text extractor — no dedicated Excel library, edge-safe.
// An .xlsx is a ZIP of XML parts; unzips with the already-installed jszip
// dependency and parses the first worksheet's XML with regex (same approach
// as pdf-extract.ts / scraper.ts in this same module). Only the first sheet
// is processed — product catalogs are expected to be single-sheet.

import JSZip from "jszip";
import { rowsToKnowledgeText } from "./catalog-format";

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

export async function extractTextFromXlsx(bytes: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);

  const sharedStringsFile = zip.file("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsFile ? parseSharedStrings(await sharedStringsFile.async("text")) : [];

  const sheetFile = zip.file("xl/worksheets/sheet1.xml");
  if (!sheetFile) return "";

  const rows = parseSheetRows(await sheetFile.async("text"), sharedStrings);
  return rowsToKnowledgeText(rows);
}
