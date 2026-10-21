import ts from "typescript";
import { describe, expect, it } from "vitest";

/**
 * EKRAN BALANDLIGI QO'RIQCHISI (Trello HcUjGTxT «d857a3»).
 * iOS Safari'da `100vh` (Tailwind `h-screen` / `min-h-screen` / `max-h-screen`) manzil paneli YOPIQ holatdagi
 * balandlik — panel ochiq bo'lsa kontent (asosiy tugma) ekrandan pastga tushib qoladi. `src/` da faqat dinamik
 * birlik: `100dvh` / `h-dvh` / `min-h-dvh` (yoki `svh` — ataylab eng kichik balandlik kerak bo'lsa).
 *
 * Ratchet: `ALLOWED` — qolgan eski joylar (fayl → son); faqat kamayadi. Hozir bo'sh — yangisi qo'shilmaydi.
 * Izohlardagi eslatmalar hisobga kirmaydi (TS/TSX izohlari parser bilan aniqlanadi — satrdagi `image/*` izoh emas).
 */

const sources = import.meta.glob(["../**/*.{ts,tsx,css}", "!../**/*.test.{ts,tsx}"], {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

/** Fayl → ruxsat etilgan uchrashuvlar soni (ratchet; faqat kamayadi, yangi kalit qo'shilmaydi). */
const ALLOWED: Readonly<Record<string, number>> = {};

/** `100vh` va Tailwind `h-screen` oilasi (`min-h-screen`, `max-h-screen`, variantlari bilan: `md:h-screen`). */
const VIEWPORT_HEIGHT_PATTERN = /(?<![\w.-])100vh\b|(?<![\w-])(?:min-|max-)?h-screen(?![\w-])/g;

/**
 * Izoh oraliqlari [boshi, oxiri). TS/TSX — TypeScript parseri tokenlarining oldingi trivia'sidan: satr ichidagi
 * `/*` (`accept="image/*"`) yoki `//` (`"a // b"`) izoh deb sanalmaydi — regex bilan kesish shu yerda kodni
 * yashirib qo'yardi. JSX matnida trivia yo'q (u yerdagi `//` — oddiy matn). CSS — faqat `/* … *\/` bloklari.
 */
const commentRanges = (path: string, text: string): Array<[number, number]> => {
  if (path.endsWith(".css")) return [...text.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => [m.index, m.index + m[0].length]);
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, kind);
  const ranges: Array<[number, number]> = [];
  const visit = (node: ts.Node) => {
    const children = node.getChildren(source);
    if (children.length > 0) {
      children.forEach(visit);
    } else if (node.kind !== ts.SyntaxKind.JsxText) {
      // Token oldidagi trivia: avvalgi token bilan bir qatordagi izoh (`trailing`) + keyingi qatorlardagilar (`leading`).
      const trivia = [...(ts.getTrailingCommentRanges(text, node.pos) ?? []), ...(ts.getLeadingCommentRanges(text, node.pos) ?? [])];
      for (const range of trivia) ranges.push([range.pos, range.end]);
    }
  };
  visit(source);
  return ranges;
};

const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

/** Fayldagi `100vh` / `h-screen` oilasi uchrashuvlari (izohlardagilardan tashqari). Fayl turi — `path` kengaytmasi. */
const findViewportHeightUses = (text: string, path = "probe.tsx") => {
  const matches = [...text.matchAll(VIEWPORT_HEIGHT_PATTERN)];
  if (matches.length === 0) return []; // parser faqat shubhali fayllarda ishlaydi — qo'riqchi tez qoladi
  const comments = commentRanges(path, text);
  return matches
    .filter(({ index }) => !comments.some(([start, end]) => index >= start && index < end))
    .map(({ index, 0: match }) => ({ line: lineOf(text, index), match }));
};

const scan = () =>
  Object.entries(sources)
    .map(([path, text]) => ({ path: path.replace(/^\.\.\//, "src/"), uses: findViewportHeightUses(text, path) }))
    .filter(({ uses }) => uses.length > 0);

describe("viewport height guard (100vh → dvh)", () => {
  it("scans the source tree (ts, tsx va css)", () => {
    const paths = Object.keys(sources);
    expect(paths.length).toBeGreaterThan(300);
    expect(paths).toContain("../index.css");
    expect(paths.some((path) => path.endsWith(".test.tsx"))).toBe(false);
  });

  it("naqsh: 100vh va h-screen oilasini topadi, dvh / svh va boshqa nomlarni emas", () => {
    const hits = (text: string, path?: string) => findViewportHeightUses(text, path).map((use) => use.match);
    expect(hits(`<div className="min-h-screen md:h-screen max-h-screen" />`)).toEqual([
      "min-h-screen",
      "h-screen",
      "max-h-screen",
    ]);
    expect(hits(".shell { min-height: 100vh; height: calc(100vh - 64px); }", "x.css")).toEqual(["100vh", "100vh"]);
    expect(hits(`style={{ maxHeight: "100vh" }}`)).toEqual(["100vh"]);
    expect(hits(`<div className="min-h-dvh h-[100dvh] max-h-[100svh] w-screen" />`)).toEqual([]);
    expect(hits(`const x = "100vhx"; const y = "data-h-screen-id";`)).toEqual([]);
    expect(hits("// eski: min-h-screen edi\n/* 100vh — iOS'da xato */")).toEqual([]);
    expect(hits(`<div>{/* min-h-screen edi */}</div>`)).toEqual([]);
    expect(hits(`const a = 1; // min-h-screen edi\nconst b = 2; /* 100vh */ const c = 3;`, "probe.ts")).toEqual([]);
  });

  it("satr ichidagi `/*` va `//` izoh ochmaydi — keyingi kod yashirinmaydi", () => {
    const hits = (text: string, path?: string) => findViewportHeightUses(text, path).map((use) => use.match);
    expect(hits(`<input accept="image/*" />\n<div className="min-h-screen" />\n/** x */`)).toEqual(["min-h-screen"]);
    expect(hits(`const glob = "src/**/*.ts";\nconst c = "h-screen";\n// */`, "probe.ts")).toEqual(["h-screen"]);
    expect(hits(`const url = "https://x.uz"; const c = "a // b min-h-screen";`, "probe.ts")).toEqual(["min-h-screen"]);
    expect(hits(`const re = /["'/*]/; const c = "max-h-screen"; // */`, "probe.ts")).toEqual(["max-h-screen"]);
    expect(hits(`<p>Don't // stop</p>\n<div className="h-screen" />`)).toEqual(["h-screen"]);
    // CSS: faqat blok izohlar; `url(//…)` izoh emas.
    expect(hits(`.a { background: url(//cdn/x.png); min-height: 100vh; } /* 100vh */`, "x.css")).toEqual(["100vh"]);
  });

  it("src/ da 100vh / h-screen / min-h-screen yo'q (faqat dvh) — ratchet", () => {
    const found = scan();
    const over = found
      .filter(({ path, uses }) => uses.length > (ALLOWED[path] ?? 0))
      .map(({ path, uses }) => `${path}: ${uses.map((use) => `${use.line}:${use.match}`).join(", ")}`);
    expect(over, "100vh o'rniga 100dvh, h-screen o'rniga h-dvh, min-h-screen o'rniga min-h-dvh").toEqual([]);
  });

  it("ratchet faqat kamayadi: ruxsat ro'yxatidagi har fayl hali shuncha joyga ega (tozalangan bo'lsa — o'chiring)", () => {
    const counts = Object.fromEntries(scan().map(({ path, uses }) => [path, uses.length]));
    const stale = Object.entries(ALLOWED)
      .filter(([path, allowed]) => (counts[path] ?? 0) < allowed)
      .map(([path, allowed]) => `${path}: ${counts[path] ?? 0} < ${allowed}`);
    expect(stale).toEqual([]);
  });
});
