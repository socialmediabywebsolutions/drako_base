// Shared row -> knowledge-text formatting for catalog uploads (CSV/Excel).
// Turns a 2D array of cells into "Column: value | Column: value" lines so the
// AI can associate each value with its column header (e.g. product/price/description).

export const CATALOG_MAX_OUTPUT_CHARS = 50_000;
const CATALOG_MAX_ROWS = 500;

export function rowsToKnowledgeText(rows: string[][]): string {
  const nonEmptyRows = rows
    .map((row) => row.map((cell) => (cell ?? "").trim()))
    .filter((row) => row.some((cell) => cell.length > 0))
    .slice(0, CATALOG_MAX_ROWS);

  if (!nonEmptyRows.length) return "";

  const [header, ...dataRows] = nonEmptyRows;
  const hasHeader = header.some((cell) => cell.length > 0) && dataRows.length > 0;

  const lines: string[] = [];

  if (hasHeader) {
    for (const row of dataRows) {
      const parts = header
        .map((label, idx) => {
          const value = row[idx]?.trim();
          if (!value) return null;
          return `${label || `Col${idx + 1}`}: ${value}`;
        })
        .filter((part): part is string => part !== null);
      if (parts.length) lines.push(parts.join(" | "));
    }
  } else {
    for (const row of nonEmptyRows) {
      const joined = row.filter(Boolean).join(" | ");
      if (joined) lines.push(joined);
    }
  }

  return lines.join("\n").slice(0, CATALOG_MAX_OUTPUT_CHARS);
}
