// Lightweight CSV parser — no external dependencies, edge-safe.
// Handles RFC 4180 quoting (quoted fields, embedded commas/newlines, escaped "" quotes).

import { rowsToKnowledgeText } from "./catalog-format";

const MAX_INPUT_ROWS = 2000;

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += char; i++; continue;
    }

    if (char === '"') { inQuotes = true; i++; continue; }
    if (char === ",") { row.push(field); field = ""; i++; continue; }
    if (char === "\r") { i++; continue; }
    if (char === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
      i++;
      continue;
    }
    field += char; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

export function extractTextFromCsv(text: string): string {
  const rows = parseCsvRows(text).slice(0, MAX_INPUT_ROWS);
  return rowsToKnowledgeText(rows);
}
