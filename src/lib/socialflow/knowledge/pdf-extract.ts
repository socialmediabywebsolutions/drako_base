// Lightweight PDF text extractor — no external dependencies, edge-safe.
// Works on text-based PDFs by parsing content streams.
// Does NOT handle scanned/image PDFs (those require OCR).

const MAX_OUTPUT_CHARS = 50_000;

function decodeOctalEscapes(value: string): string {
  return value.replace(/\\(\d{1,3})/g, (_, oct) => {
    const code = parseInt(oct, 8);
    return code > 31 && code < 127 ? String.fromCharCode(code) : " ";
  });
}

function decodePdfString(raw: string): string {
  return decodeOctalEscapes(raw)
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\\\/g, "\\")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")");
}

// Extract text tokens from a single PDF content stream chunk.
function extractTextFromStream(stream: string): string {
  const parts: string[] = [];
  let inTextBlock = false;
  let pos = 0;

  while (pos < stream.length) {
    // Detect BT (begin text) / ET (end text)
    if (stream[pos] === "B" && stream[pos + 1] === "T" && (pos === 0 || /\s/.test(stream[pos - 1]))) {
      inTextBlock = true;
      pos += 2;
      continue;
    }
    if (stream[pos] === "E" && stream[pos + 1] === "T" && (pos === 0 || /\s/.test(stream[pos - 1]))) {
      inTextBlock = false;
      parts.push(" ");
      pos += 2;
      continue;
    }

    if (!inTextBlock) { pos++; continue; }

    // Literal string: (text) Tj  or  (text) '
    if (stream[pos] === "(") {
      let depth = 1;
      let i = pos + 1;
      while (i < stream.length && depth > 0) {
        if (stream[i] === "\\" && i + 1 < stream.length) { i += 2; continue; }
        if (stream[i] === "(") depth++;
        else if (stream[i] === ")") depth--;
        i++;
      }
      const inner = stream.slice(pos + 1, i - 1);
      const ahead = stream.slice(i).trimStart();
      if (/^(Tj|TJ|'|")/.test(ahead)) {
        parts.push(decodePdfString(inner));
      }
      pos = i;
      continue;
    }

    // Array string: [(text) -number (text)] TJ
    if (stream[pos] === "[") {
      let i = pos + 1;
      let depth = 1;
      const arrayParts: string[] = [];
      while (i < stream.length && depth > 0) {
        if (stream[i] === "[") { depth++; i++; continue; }
        if (stream[i] === "]") { depth--; i++; continue; }
        if (stream[i] === "(") {
          let jDepth = 1;
          let j = i + 1;
          while (j < stream.length && jDepth > 0) {
            if (stream[j] === "\\" && j + 1 < stream.length) { j += 2; continue; }
            if (stream[j] === "(") jDepth++;
            else if (stream[j] === ")") jDepth--;
            j++;
          }
          arrayParts.push(decodePdfString(stream.slice(i + 1, j - 1)));
          i = j;
          continue;
        }
        i++;
      }
      const ahead = stream.slice(i).trimStart();
      if (/^TJ/.test(ahead) && arrayParts.length) {
        parts.push(arrayParts.join(""));
      }
      pos = i;
      continue;
    }

    pos++;
  }

  return parts.join(" ").replace(/\s{3,}/g, "  ").trim();
}

export function extractTextFromPdf(bytes: ArrayBuffer): string {
  // Decode as latin-1 to preserve byte values (PDF is not always UTF-8)
  const decoder = new TextDecoder("latin1");
  const raw = decoder.decode(bytes);

  const parts: string[] = [];
  let totalLen = 0;

  // Find all content streams: objects between "stream\r\n" and "endstream"
  const streamPattern = /stream[\r\n]+([\s\S]*?)endstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamPattern.exec(raw)) !== null && totalLen < MAX_OUTPUT_CHARS) {
    const chunk = match[1];
    // Only process if this stream contains text operators
    if (!/\bTj\b|\bTJ\b/.test(chunk)) continue;
    const extracted = extractTextFromStream(chunk);
    if (extracted) {
      parts.push(extracted);
      totalLen += extracted.length;
    }
  }

  if (!parts.length) {
    // Fallback: grab any printable ASCII sequences ≥ 4 chars that look like words
    const words = raw.match(/[A-Za-z][A-Za-z0-9 ,.'!?;:()\-]{3,}/g) ?? [];
    return words.join(" ").slice(0, MAX_OUTPUT_CHARS);
  }

  return parts.join("\n").slice(0, MAX_OUTPUT_CHARS);
}
