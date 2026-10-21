import { describe, expect, it } from "vitest";

/**
 * EKRAN BALANDLIGI QO'RIQCHISI (Trello HcUjGTxT «d857a3»).
 * iOS Safari'da `100vh` (Tailwind `h-screen` / `min-h-screen` / `max-h-screen`) manzil paneli YOPIQ holatdagi
 * balandlik — panel ochiq bo'lsa kontent (asosiy tugma) ekrandan pastga tushib qoladi. `src/` da faqat dinamik
 * birlik: `100dvh` / `h-dvh` / `min-h-dvh` (yoki `svh` — ataylab eng kichik balandlik kerak bo'lsa).
 *
 * Ratchet: `ALLOWED` — qolgan eski joylar (fayl → son); faqat kamayadi. Hozir bo'sh — yangisi qo'shilmaydi.
 * Izohlardagi eslatmalar hisobga kirmaydi.
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

/** `//` va `/* … *\/` izohlarini olib tashlaydi (qator raqamlari saqlanadi). */
const stripComments = (text: string) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, (_line, lead: string) => lead);

const findViewportHeightUses = (text: string) =>
  stripComments(text)
    .split("\n")
    .flatMap((line, index) => [...line.matchAll(VIEWPORT_HEIGHT_PATTERN)].map((match) => ({ line: index + 1, match: match[0] })));

const scan = () =>
  Object.entries(sources)
    .map(([path, text]) => ({ path: path.replace(/^\.\.\//, "src/"), uses: findViewportHeightUses(text) }))
    .filter(({ uses }) => uses.length > 0);

describe("viewport height guard (100vh → dvh)", () => {
  it("scans the source tree (ts, tsx va css)", () => {
    const paths = Object.keys(sources);
    expect(paths.length).toBeGreaterThan(300);
    expect(paths).toContain("../index.css");
    expect(paths.some((path) => path.endsWith(".test.tsx"))).toBe(false);
  });

  it("naqsh: 100vh va h-screen oilasini topadi, dvh / svh va boshqa nomlarni emas", () => {
    const hits = (text: string) => findViewportHeightUses(text).map((use) => use.match);
    expect(hits(`<div className="min-h-screen md:h-screen max-h-screen" />`)).toEqual([
      "min-h-screen",
      "h-screen",
      "max-h-screen",
    ]);
    expect(hits(".shell { min-height: 100vh; height: calc(100vh - 64px); }")).toEqual(["100vh", "100vh"]);
    expect(hits(`style={{ maxHeight: "100vh" }}`)).toEqual(["100vh"]);
    expect(hits(`<div className="min-h-dvh h-[100dvh] max-h-[100svh] w-screen" />`)).toEqual([]);
    expect(hits(`const x = "100vhx"; const y = "data-h-screen-id";`)).toEqual([]);
    expect(hits("// eski: min-h-screen edi\n/* 100vh — iOS'da xato */")).toEqual([]);
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
