/** First record decides the delimiter. A quoted cell does not count. */
export function detectCsvDelimiter(text: string): ',' | ';' {
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if (char === '\n' || char === '\r') break;
    if (char === ',') commas += 1;
    if (char === ';') semis += 1;
  }
  return semis > commas ? ';' : ',';
}

/** RFC 4180 records. Quoted cells may contain the delimiter and line breaks. */
export function parseCsvRecords(text: string, delimiter: ',' | ';' = detectCsvDelimiter(text)): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');

  const pushCell = () => {
    row.push(cell.trim());
    cell = '';
  };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => value !== '')) records.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i += 1) {
    const char = src[i];
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      pushCell();
      continue;
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && src[i + 1] === '\n') i += 1;
      pushRow();
      continue;
    }
    cell += char;
  }
  if (cell.length > 0 || row.length > 0) pushRow();
  return records;
}
