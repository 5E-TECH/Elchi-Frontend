import type { jsPDF } from "jspdf";
import { createPairKerning, type ReceiptPairKerning } from "./printReceiptKerning";
import { ReceiptFontError } from "./receiptErrors";
import manropeMediumUrl from "../../../shared/assets/fonts/Manrope-Medium.ttf?url";
import manropeSemiBoldUrl from "../../../shared/assets/fonts/Manrope-SemiBold.ttf?url";
import manropeBoldUrl from "../../../shared/assets/fonts/Manrope-Bold.ttf?url";
import notoMediumUrl from "../../../shared/assets/fonts/NotoSans-UzCyrillic-Medium.ttf?url";
import notoBoldUrl from "../../../shared/assets/fonts/NotoSans-UzCyrillic-Bold.ttf?url";

/**
 * CHEK SHRIFTLARI (HJ5sLHiz, maket `tizim-receipts`, TZ F2). Chek faqat o'z TTF fayllari bilan o'lchanadi va chiziladi
 * (`src/shared/assets/fonts/README.md`): jsPDF ularni PDF ichiga joylaydi, brauzer oynasi o'sha fayllarni `@font-face`
 * bilan yuklaydi — kenglik ikkala chiqishda bir xil. `canvas.measureText` ishlatilmaydi: o'lchash bitta —
 * jsPDF `getStringUnitWidth` (glif kengligi) + shu TTF dagi GPOS kerning (`printReceiptKerning.ts`; maket brauzerda
 * kerning bilan chizilgan). Kerningni rendererlar o'zi qo'yadi (`ReceiptTextOp.kern`), brauzerniki o'chiq
 * (`font-kerning: none`), ligatura yo'q.
 *
 * Fayllar `?url` bilan faqat chop etishda `fetch` qilinadi va modul darajasida keshlanadi (ilova yuklanishiga kirmaydi).
 */

export type ReceiptWeight = 500 | 600 | 700;
export type ReceiptFace = "manrope-500" | "manrope-600" | "manrope-700" | "noto-500" | "noto-700";

/** 1 pt = 25,4 / 72 mm. */
export const MM_PER_PT = 25.4 / 72;

/**
 * Manrope hhea (= OS/2 typo, win) ascent / descent, em: 2132 / 2000 va 600 / 2000. Bazaviy chiziq shundan hisoblanadi;
 * HTML'da har yuzga `ascent-override` / `descent-override` shu qiymat bilan beriladi — Noto bo'lagi ham o'sha chiziqda.
 */
export const RECEIPT_FONT_METRICS = Object.freeze({ ascent: 2132 / 2000, descent: 600 / 2000 });

/** HTML chop etish oynasidagi shrift oilasi (ikkala TTF bitta oila, `unicode-range` bilan bo'lingan). */
export const RECEIPT_FONT_FAMILY = "ElchiReceipt";

interface FaceInfo {
  url: string;
  /** jsPDF dagi nom (`addFont` → `setFont`). */
  pdfName: string;
  /** jsPDF VFS fayl nomi. */
  file: string;
  weight: ReceiptWeight;
  /** HTML `unicode-range`. */
  unicodeRange: string;
}

/** Manrope'da bo'lmagan o'zbek kirill harflari (қ ғ ҳ Қ Ғ Ҳ …): U+0490–04FF butunlay Noto Sans'dan. */
const NOTO_FIRST = 0x0490;
const NOTO_LAST = 0x04ff;
const MANROPE_UNICODE_RANGE = "U+0000-048F, U+0500-10FFFF";
const NOTO_UNICODE_RANGE = "U+0490-04FF";

export const RECEIPT_FACES: Readonly<Record<ReceiptFace, FaceInfo>> = Object.freeze({
  "manrope-500": {
    url: manropeMediumUrl,
    pdfName: "ElchiManrope500",
    file: "Manrope-Medium.ttf",
    weight: 500,
    unicodeRange: MANROPE_UNICODE_RANGE,
  },
  "manrope-600": {
    url: manropeSemiBoldUrl,
    pdfName: "ElchiManrope600",
    file: "Manrope-SemiBold.ttf",
    weight: 600,
    unicodeRange: MANROPE_UNICODE_RANGE,
  },
  "manrope-700": {
    url: manropeBoldUrl,
    pdfName: "ElchiManrope700",
    file: "Manrope-Bold.ttf",
    weight: 700,
    unicodeRange: MANROPE_UNICODE_RANGE,
  },
  "noto-500": {
    url: notoMediumUrl,
    pdfName: "ElchiNoto500",
    file: "NotoSans-UzCyrillic-Medium.ttf",
    weight: 500,
    unicodeRange: NOTO_UNICODE_RANGE,
  },
  "noto-700": {
    url: notoBoldUrl,
    pdfName: "ElchiNoto700",
    file: "NotoSans-UzCyrillic-Bold.ttf",
    weight: 700,
    unicodeRange: NOTO_UNICODE_RANGE,
  },
});

export const RECEIPT_FACE_LIST = Object.keys(RECEIPT_FACES) as ReceiptFace[];

/**
 * Manrope 4.505 cmap qamrovi (500/600/700 bir xil; `README.md` dagi fayllardan, fontTools bilan olingan). Shundan
 * tashqaridagi belgi (U+0490–04FF dan boshqa) chekda «?» bo'ladi — PDF va brauzer kengligi farq qilmasin.
 */
const MANROPE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0020, 0x007e],
  [0x00a0, 0x0113],
  [0x0116, 0x012b],
  [0x012e, 0x0131],
  [0x0134, 0x0137],
  [0x0139, 0x013e],
  [0x0141, 0x0148],
  [0x014a, 0x014d],
  [0x0150, 0x017e],
  [0x0192, 0x0192],
  [0x01a0, 0x01a1],
  [0x01af, 0x01b0],
  [0x0218, 0x021b],
  [0x0259, 0x0259],
  [0x02c6, 0x02c7],
  [0x02d8, 0x02dd],
  [0x0374, 0x0375],
  [0x037e, 0x037e],
  [0x0384, 0x038a],
  [0x038c, 0x038c],
  [0x038e, 0x03a1],
  [0x03a3, 0x03ce],
  [0x0400, 0x045f],
  [0x1e80, 0x1e85],
  [0x1e9e, 0x1e9e],
  [0x1ea0, 0x1ef9],
  [0x2011, 0x2011],
  [0x2013, 0x2014],
  [0x2018, 0x201a],
  [0x201c, 0x2022],
  [0x2026, 0x2026],
  [0x2030, 0x2030],
  [0x2039, 0x203a],
  [0x2044, 0x2044],
  [0x2070, 0x2070],
  [0x2074, 0x2079],
  [0x2080, 0x2089],
  [0x20a3, 0x20a3],
  [0x20a9, 0x20ac],
  [0x20ae, 0x20ae],
  [0x20b1, 0x20b1],
  [0x20b4, 0x20b4],
  [0x20b9, 0x20ba],
  [0x20bd, 0x20bd],
  [0x20bf, 0x20bf],
  [0x2116, 0x2116],
  [0x2122, 0x2122],
  [0x2190, 0x2193],
  [0x21b5, 0x21b5],
  [0x2202, 0x2202],
  [0x2205, 0x2205],
  [0x220f, 0x220f],
  [0x2211, 0x2212],
  [0x2215, 0x2215],
  [0x221a, 0x221a],
  [0x221e, 0x221e],
  [0x222b, 0x222b],
  [0x2248, 0x2248],
  [0x2260, 0x2260],
  [0x2264, 0x2265],
  [0x25ca, 0x25ca],
];

const isNotoCode = (code: number) => code >= NOTO_FIRST && code <= NOTO_LAST;
const isManropeCode = (code: number) =>
  MANROPE_RANGES.some(([from, to]) => code >= from && code <= to);

/** Belgi chekda chiziladimi (Manrope yoki Noto bo'lagi). */
export const isReceiptCodePoint = (code: number) => isNotoCode(code) || isManropeCode(code);

/** Belgining yuzi: U+0490–04FF — Noto (600 → 700), qolgani — Manrope. */
export const faceOf = (code: number, weight: ReceiptWeight): ReceiptFace => {
  if (isNotoCode(code)) return weight === 500 ? "noto-500" : "noto-700";
  return `manrope-${weight}`;
};

// O'zbek lotinidagi tutuq/ayirish belgisi (ʻ ʼ va qo'shnilari) — Manrope'da yo'q, chekda «'» (TZ F2).
const APOSTROPHES = /[\u02b9\u02bb\u02bc\u02bd\u02be\u02bf]/g;
// Har xil bo'sh joy, tab, yangi qator → bitta bo'sh joy (chek qatorlari o'zi o'raladi).
const SPACES = /[\s\u00a0\u2000-\u200a\u202f\u205f\u3000]+/g;
// Ko'rinmas va bezak belgilari: format belgilari (nol kenglik, yumshoq defis, BOM), diakritika va variant tanlovchilar, emoji.
const INVISIBLE = /\p{Cf}|\p{M}|\p{Extended_Pictographic}/gu;
/** Boshqaruv belgilari (C0, DEL, C1) — `SPACES` dan keyin qolganlari tashlab yuboriladi. */
const isControlCode = (code: number) => code < 0x20 || (code >= 0x7f && code <= 0x9f);

/**
 * Chek matni: NFC, ʻ ʼ → «'», bo'sh joylar bittaga, ko'rinmas belgilar va emoji olib tashlanadi, ikkala shriftda ham yo'q
 * belgi → «?». Bo'sh yoki satr bo'lmagan qiymat → `""` (chekda «-» / «—» chiqmaydi).
 */
export const normalizeReceiptText = (value: unknown): string => {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = String(value)
    .normalize("NFC")
    .replace(APOSTROPHES, "'")
    .replace(SPACES, " ")
    .replace(INVISIBLE, "")
    .replace(SPACES, " ")
    .trim();
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (isControlCode(code)) continue;
    out += isReceiptCodePoint(code) ? char : "?";
  }
  return out;
};

export interface ReceiptFaceRun {
  face: ReceiptFace;
  text: string;
}

/** Matnni yuzlar bo'yicha bo'laklaydi (PDF har bo'lakni o'z shriftida chizadi; HTML `unicode-range` bilan o'zi bo'ladi). */
export const splitFaceRuns = (text: string, weight: ReceiptWeight): ReceiptFaceRun[] => {
  const runs: ReceiptFaceRun[] = [];
  for (const char of text) {
    const face = faceOf(char.codePointAt(0) ?? 0, weight);
    const last = runs[runs.length - 1];
    if (last && last.face === face) last.text += char;
    else runs.push({ face, text: char });
  }
  return runs;
};

/** Belgi kengligi, em (1 pt shriftda — pt). */
export type ReceiptGlyphWidth = (face: ReceiptFace, char: string) => number;

/** Kerning joyi: `[indeks, mm]` — matn `text.slice(0, indeks)` dan keyin shuncha suriladi (manfiy — yaqinlashadi). */
export type ReceiptKern = readonly [index: number, offset: number];

/**
 * Matn kengligi, mm (kerning bilan). Joylash algoritmiga parametr — brauzer, PDF va vitest bir xil o'lchaydi.
 * `kerning` — o'sha kerning juftliklari: joylash ularni matn amaliga yozadi (`ReceiptTextOp.kern`), rendererlar
 * shu joylarda suradi. Yo'q (soxta o'lchovchi) — kerningsiz.
 */
export interface ReceiptMeasure {
  (text: string, pt: number, weight: ReceiptWeight): number;
  kerning?: (text: string, pt: number, weight: ReceiptWeight) => ReceiptKern[];
}

/** Yuzning juftlik kerningi, em (bir yuz ichida; yuzlar chegarasida kerning yo'q — brauzer ham shunday). */
export type ReceiptFaceKerning = (face: ReceiptFace, left: string, right: string) => number;

/**
 * Satr kengligi = belgilar kengligi + bir yuz ichidagi qo'shni juftliklar kerningi (HarfBuzz `kern` bilan bir xil;
 * `kerning` berilmasa — jsPDF `widthOfString` kabi kerningsiz).
 */
export const createReceiptMeasure = (
  glyphWidth: ReceiptGlyphWidth,
  pairKerning?: ReceiptFaceKerning,
): ReceiptMeasure => {
  const glyphs = new Map<ReceiptFace, Map<string, number>>();
  const strings = new Map<string, number>();
  const charEm = (face: ReceiptFace, char: string) => {
    let faceCache = glyphs.get(face);
    if (!faceCache) {
      faceCache = new Map();
      glyphs.set(face, faceCache);
    }
    let width = faceCache.get(char);
    if (width === undefined) {
      width = glyphWidth(face, char);
      faceCache.set(char, width);
    }
    return width;
  };
  /** `visit(indeks, em)` — har nol bo'lmagan juftlik uchun (indeks — o'ng belgining boshi). */
  const eachKern = (
    text: string,
    weight: ReceiptWeight,
    visit: (index: number, em: number) => void,
  ) => {
    if (!pairKerning) return;
    let index = 0;
    let previous = "";
    let previousFace: ReceiptFace | null = null;
    for (const char of text) {
      const face = faceOf(char.codePointAt(0) ?? 0, weight);
      if (previousFace === face) {
        const em = pairKerning(face, previous, char);
        if (em) visit(index, em);
      }
      previous = char;
      previousFace = face;
      index += char.length;
    }
  };
  const measure: ReceiptMeasure = (text, pt, weight) => {
    const key = `${weight}|${text}`;
    let em = strings.get(key);
    if (em === undefined) {
      let sum = 0;
      for (const char of text) sum += charEm(faceOf(char.codePointAt(0) ?? 0, weight), char);
      eachKern(text, weight, (_index, value) => {
        sum += value;
      });
      em = sum;
      // Joylash bir xil so'zlarni ko'p o'lchaydi (pog'onalar, k = n … 1); kesh cheksiz o'smasin.
      if (strings.size > 50_000) strings.clear();
      strings.set(key, em);
    }
    return em * pt * MM_PER_PT;
  };
  if (pairKerning) {
    measure.kerning = (text, pt, weight) => {
      const kerns: ReceiptKern[] = [];
      eachKern(text, weight, (index, em) => kerns.push([index, em * pt * MM_PER_PT]));
      return kerns;
    };
  }
  return measure;
};

/** Shrift fayllari: jsPDF VFS'ga beriladigan ikkilik satr (`\x00\x01\x00\x00…`). */
export type ReceiptFontData = Readonly<Record<ReceiptFace, string>>;

export { ReceiptFontError };

const toBinaryString = (bytes: Uint8Array) => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return out;
};

/** Brauzerda: fayl `fetch` qilinadi. Testda — diskdan o'quvchi beriladi. */
export type ReceiptFontLoader = (face: ReceiptFace, url: string) => Promise<Uint8Array>;

const fetchFont: ReceiptFontLoader = async (_face, url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
};

let fontDataPromise: Promise<ReceiptFontData> | null = null;

/** Beshala yuz bir marta yuklanadi va keshlanadi; xatoda kesh tozalanadi — «Qayta urinish» qaytadan so'raydi. */
export const loadReceiptFontData = (
  loader: ReceiptFontLoader = fetchFont,
): Promise<ReceiptFontData> => {
  if (!fontDataPromise) {
    fontDataPromise = Promise.all(
      RECEIPT_FACE_LIST.map(
        async (face) =>
          [face, toBinaryString(await loader(face, RECEIPT_FACES[face].url))] as const,
      ),
    )
      .then((entries) => Object.freeze(Object.fromEntries(entries)) as ReceiptFontData)
      .catch((cause: unknown) => {
        fontDataPromise = null;
        throw new ReceiptFontError("Chek shriftlari yuklanmadi", { cause });
      });
  }
  return fontDataPromise;
};

/** Faqat testlar uchun: keshni tozalash. */
export const resetReceiptFontCache = () => {
  fontDataPromise = null;
};

/** Yuzlarni jsPDF hujjatiga qo'shadi (VFS + `addFont`). */
export const registerReceiptFonts = (pdf: jsPDF, data: ReceiptFontData) => {
  for (const face of RECEIPT_FACE_LIST) {
    const info = RECEIPT_FACES[face];
    pdf.addFileToVFS(info.file, data[face]);
    pdf.addFont(info.file, info.pdfName, "normal");
  }
};

/**
 * jsPDF hujjatidagi (shriftlari qo'shilgan) TTF metrikasi bilan o'lchovchi; `data` — o'sha fayllar: GPOS kerningi
 * shulardan o'qiladi (berilmasa — kerningsiz).
 */
export const createPdfReceiptMeasure = (pdf: jsPDF, data?: ReceiptFontData): ReceiptMeasure => {
  const fonts = new Map<ReceiptFace, ReturnType<jsPDF["getFont"]>>();
  const fontOf = (face: ReceiptFace) => {
    let font = fonts.get(face);
    if (!font) {
      pdf.setFont(RECEIPT_FACES[face].pdfName, "normal");
      font = pdf.getFont();
      fonts.set(face, font);
    }
    return font;
  };
  let pairKerning: ReceiptFaceKerning | undefined;
  if (data) {
    const kernings = new Map<ReceiptFace, ReceiptPairKerning>();
    pairKerning = (face, left, right) => {
      let kerning = kernings.get(face);
      if (!kerning) {
        kerning = createPairKerning(data[face]);
        kernings.set(face, kerning);
      }
      return kerning(left, right);
    };
  }
  return createReceiptMeasure(
    (face, char) => pdf.getStringUnitWidth(char, { font: fontOf(face) }),
    pairKerning,
  );
};

/**
 * HTML chop etish oynasi uchun `@font-face` qoidalari: mutlaq URL (oyna `blob:` manzilda), metrikalar qotirilgan,
 * `font-display: block` — shrift yuklanmaguncha zaxira shrift bilan chizilmaydi.
 */
export const receiptFontFaceCss = (resolveUrl: (url: string) => string): string => {
  const ascent = (RECEIPT_FONT_METRICS.ascent * 100).toFixed(1);
  const descent = (RECEIPT_FONT_METRICS.descent * 100).toFixed(1);
  return RECEIPT_FACE_LIST.map((face) => {
    const info = RECEIPT_FACES[face];
    return (
      `@font-face{font-family:"${RECEIPT_FONT_FAMILY}";src:url("${resolveUrl(info.url)}") format("truetype");` +
      `font-weight:${info.weight};font-style:normal;font-display:block;unicode-range:${info.unicodeRange};` +
      `ascent-override:${ascent}%;descent-override:${descent}%;line-gap-override:0%}`
    );
  }).join("\n");
};

/**
 * `document.fonts.load` uchun so'rovlar: har yuz o'z belgisi bilan (Noto faqat U+0490–04FF matnida yuklanadi).
 * Har biri kamida bitta yuklangan yuz qaytarishi kerak.
 */
export const RECEIPT_FONT_PROBES: ReadonlyArray<{ font: string; text: string }> =
  RECEIPT_FACE_LIST.map((face) => ({
    font: `${RECEIPT_FACES[face].weight} 10pt "${RECEIPT_FONT_FAMILY}"`,
    text: face.startsWith("noto") ? "қ" : "A",
  }));
