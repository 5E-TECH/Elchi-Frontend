/**
 * ────────────────────────────────────────────────────────────────────────────
 *  KICHIK MARKDOWN O'QUVCHI — AI javoblari uchun (F7PWp6cK, `done.answer`)
 * ────────────────────────────────────────────────────────────────────────────
 *
 *  Toza: matn → bloklar daraxti (HTML YO'Q). Chizish — `shared/ui/markdown/MiniMarkdown.tsx` (faqat React tugunlari,
 *  `dangerouslySetInnerHTML` yo'q). Qo'llanadi: paragraf (ichidagi qator ko'chishi saqlanadi), `#`–`######`
 *  sarlavha, `-` / `*` / `+` va `1.` ro'yxat (ichma-ich ro'yxat tekislanadi), GFM jadval (`| a | b |` +
 *  `|---|---:|`), `---` chiziq, ``` blok (matn sifatida); qator ichida `**qalin**` / `__qalin__`, `*kursiv*` /
 *  `_kursiv_` (so'z ichidagi `_` — masalan `get_cash_position` — kursiv emas), `` `kod` `` (oddiy matn).
 *  Havola `[matn](url)` — faqat matni, rasm `![alt](src)` — alt matni; HTML teglar — oddiy matn (React qochiradi).
 */

export type MdInline =
  | { type: "text"; text: string }
  | { type: "strong"; children: MdInline[] }
  | { type: "em"; children: MdInline[] }
  | { type: "code"; text: string }
  | { type: "break" };

export type MdAlign = "start" | "end" | "center";

export type MdBlock =
  | { type: "paragraph"; children: MdInline[] }
  | { type: "heading"; level: number; children: MdInline[] }
  | { type: "list"; ordered: boolean; start: number; items: MdInline[][] }
  | { type: "table"; header: MdInline[][]; align: MdAlign[]; rows: MdInline[][][] }
  | { type: "rule" }
  | { type: "code"; text: string };

const HEADING_RE = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET_RE = /^\s*[-*+]\s+(.*)$/;
const ORDERED_RE = /^\s*(\d{1,9})[.)]\s+(.*)$/;
const RULE_RE = /^ {0,3}([-*_])(\s*\1){2,}\s*$/;
const FENCE_RE = /^ {0,3}(```|~~~)/;
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;

/** `| a | b |` → ["a", "b"] (qochirilgan `\|` hujayra ichida qoladi). */
const splitRow = (line: string): string[] => {
  let row = line.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];
    if (char === "\\" && row[i + 1] === "|") {
      current += "|";
      i += 1;
    } else if (char === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
};

const isTableStart = (lines: string[], index: number) =>
  lines[index].includes("|") && index + 1 < lines.length && TABLE_SEPARATOR_RE.test(lines[index + 1]) &&
  lines[index + 1].includes("-") && (lines[index + 1].includes("|") || lines[index].trim().startsWith("|"));

const alignOf = (cell: string): MdAlign => {
  const value = cell.trim();
  const left = value.startsWith(":");
  const right = value.endsWith(":");
  if (left && right) return "center";
  if (right) return "end";
  return "start";
};

/**
 * Raqamli ustun (summa, son, foiz) — o'ngga tekislanadi, ajratuvchida ko'rsatilmagan bo'lsa ham: raqam (+ ixtiyoriy
 * qisqa birlik — foiz, «ta», «mln», valyuta; 4 harfgacha).
 */
const NUMERIC_CELL_RE = /^[−+-]?\s*\d[\d\s.,]*\s*(%|[\p{L}'‘’]{1,4})?\.?$/u;

const isNumericCell = (cell: string) => cell.trim() !== "" && NUMERIC_CELL_RE.test(cell.replace(/[*_`]/g, "").trim());

const isBlockStart = (lines: string[], index: number) => {
  const line = lines[index];
  return (
    HEADING_RE.test(line) ||
    BULLET_RE.test(line) ||
    ORDERED_RE.test(line) ||
    RULE_RE.test(line) ||
    FENCE_RE.test(line) ||
    isTableStart(lines, index)
  );
};

// ─── Qator ichidagi belgilar ──────────────────────────────────────────────────

const isWordChar = (char: string | undefined) => char !== undefined && /[\p{L}\p{N}]/u.test(char);

/** `marker` ning yopilishi (`from` dan keyin); `_` va `*` uchun so'z chegarasi tekshiriladi. */
const findClosing = (text: string, marker: string, from: number): number => {
  let index = text.indexOf(marker, from);
  while (index !== -1) {
    const before = text[index - 1];
    const after = text[index + marker.length];
    const closesWord = before !== undefined && before !== " " && before !== "\t";
    const underscore = marker[0] === "_";
    if (closesWord && index > from && (!underscore || !isWordChar(after))) return index;
    index = text.indexOf(marker, index + 1);
  }
  return -1;
};

export const parseInline = (source: string): MdInline[] => {
  const out: MdInline[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) out.push({ type: "text", text: buffer });
    buffer = "";
  };

  let i = 0;
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    // `kod`
    if (char === "`") {
      const end = source.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ type: "code", text: source.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }

    // ![alt](src) → alt; [matn](url) → matn
    if (char === "!" && next === "[") {
      const match = /^!\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/.exec(source.slice(i));
      if (match) {
        buffer += match[1];
        i += match[0].length;
        continue;
      }
    }
    if (char === "[") {
      const match = /^\[([^\]]+)\]\(([^)\s]*)(?:\s+"[^"]*")?\)/.exec(source.slice(i));
      if (match) {
        flush();
        out.push(...parseInline(match[1]));
        i += match[0].length;
        continue;
      }
    }

    // **qalin** / __qalin__
    if ((char === "*" || char === "_") && next === char) {
      const marker = char + char;
      const opensWord = source[i + 2] !== undefined && source[i + 2] !== " ";
      const leftOk = char === "*" || !isWordChar(source[i - 1]);
      if (opensWord && leftOk) {
        const end = findClosing(source, marker, i + 2);
        if (end !== -1) {
          flush();
          out.push({ type: "strong", children: parseInline(source.slice(i + 2, end)) });
          i = end + 2;
          continue;
        }
      }
    }

    // *kursiv* / _kursiv_
    if (char === "*" || char === "_") {
      const opensWord = next !== undefined && next !== " " && next !== char;
      const leftOk = char === "*" || !isWordChar(source[i - 1]);
      if (opensWord && leftOk) {
        const end = findClosing(source, char, i + 1);
        if (end !== -1 && source[end + 1] !== char) {
          flush();
          out.push({ type: "em", children: parseInline(source.slice(i + 1, end)) });
          i = end + 1;
          continue;
        }
      }
    }

    // `\*` — qochirilgan belgi
    if (char === "\\" && next !== undefined && /[\\`*_[\]()#+\-.!|]/.test(next)) {
      buffer += next;
      i += 2;
      continue;
    }

    buffer += char;
    i += 1;
  }
  flush();
  return out;
};

/** Bir necha qator → qator ichidagi belgilar, qator ko'chishlari `break` bilan. */
const parseLines = (lines: string[]): MdInline[] =>
  lines.flatMap((line, index) => [
    ...(index > 0 ? [{ type: "break" } as const] : []),
    ...parseInline(line.trim()),
  ]);

// ─── Bloklar ──────────────────────────────────────────────────────────────────

export const parseMarkdown = (source: string): MdBlock[] => {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i += 1;
      continue;
    }

    if (FENCE_RE.test(line)) {
      const fence = FENCE_RE.exec(line)?.[1] ?? "```";
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith(fence)) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, children: parseInline(heading[2]) });
      i += 1;
      continue;
    }

    if (RULE_RE.test(line)) {
      blocks.push({ type: "rule" });
      i += 1;
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(line);
      const align = splitRow(lines[i + 1]).map(alignOf);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim() !== "" && lines[i].includes("|")) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      const width = header.length;
      const fitted = rows.map((row) => Array.from({ length: width }, (_, col) => row[col] ?? ""));
      const resolvedAlign = header.map((_, col) => {
        const declared = align[col] ?? "start";
        if (declared !== "start") return declared;
        const values = fitted.map((row) => row[col]).filter((cell) => cell.trim() !== "");
        return values.length > 0 && values.every(isNumericCell) ? "end" : "start";
      });
      blocks.push({
        type: "table",
        header: header.map(parseInline),
        align: resolvedAlign,
        rows: fitted.map((row) => row.map(parseInline)),
      });
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    const ordered = ORDERED_RE.exec(line);
    if (bullet || ordered) {
      const isOrdered = !bullet;
      const start = isOrdered && ordered ? Number(ordered[1]) : 1;
      const items: string[][] = [];
      while (i < lines.length) {
        const current = lines[i];
        const b = BULLET_RE.exec(current);
        const o = ORDERED_RE.exec(current);
        const indented = /^\s+/.test(current);
        // Shu turdagi band, yoki chekinishli boshqa turdagi (ichma-ich ro'yxat — tekislanadi).
        if ((isOrdered ? o : b) || (indented && (b || o))) {
          items.push([b ? b[1] : (o as RegExpExecArray)[2]]);
          i += 1;
          continue;
        }
        // Davom qatori (chekinish bilan, bo'sh emas) — oldingi bandga.
        if (indented && current.trim() !== "" && items.length > 0 && !isBlockStart(lines, i)) {
          items[items.length - 1].push(current);
          i += 1;
          continue;
        }
        break;
      }
      blocks.push({ type: "list", ordered: isOrdered, start, items: items.map(parseLines) });
      continue;
    }

    // Paragraf: keyingi bo'sh qator yoki yangi blokgacha.
    const paragraph: string[] = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines, i)) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: "paragraph", children: parseLines(paragraph) });
  }

  return blocks;
};

const plainInline = (nodes: readonly MdInline[], lineBreak: string): string =>
  nodes
    .map((node) => {
      switch (node.type) {
        case "text":
        case "code":
          return node.text;
        case "break":
          return lineBreak;
        default:
          return plainInline(node.children, lineBreak);
      }
    })
    .join("");

/** Belgilarsiz matn (ekran o'quvchi nomi): qator ko'chishi — bo'sh joy. */
export const inlineText = (nodes: readonly MdInline[]): string => plainInline(nodes, " ");

/**
 * Ekranda ko'ringan matn — belgilarsiz (javobni nusxalash: messenjer, hujjat, Excel): `**`, `_`, `#` olinadi,
 * ro'yxat — «- » / «1. » qatorlar, jadval — tab bilan ajratilgan qatorlar (Excel'ga ustunlar bo'lib tushadi),
 * bloklar orasida bo'sh qator.
 */
export const markdownToPlainText = (source: string): string =>
  parseMarkdown(source)
    .map((block) => {
      switch (block.type) {
        case "paragraph":
        case "heading":
          return plainInline(block.children, "\n");
        case "list":
          return block.items
            .map((item, index) => `${block.ordered ? `${block.start + index}.` : "-"} ${plainInline(item, "\n  ")}`)
            .join("\n");
        case "table":
          return [block.header, ...block.rows].map((row) => row.map((cell) => inlineText(cell)).join("\t")).join("\n");
        case "rule":
          return "";
        case "code":
          return block.text;
      }
    })
    .filter((text) => text !== "")
    .join("\n\n");
