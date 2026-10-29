import {
  MM_PER_PT,
  RECEIPT_FONT_METRICS,
  type ReceiptKern,
  type ReceiptMeasure,
  type ReceiptWeight,
} from "./printReceiptFonts";
import { RECEIPT_TEXT, type ReceiptAmount, type ReceiptOrderModel } from "./printReceiptModel";
import { encodeReceiptQr, receiptQrModule, type ReceiptQrSymbol } from "./printReceiptQr";

/**
 * CHEK JOYLASH ALGORITMI (HJ5sLHiz, maket `tizim-receipts` 01 · 01.B · 04, TZ F3–F6).
 *
 * Natija — rendererdan mustaqil chizish amallari (mm, qog'oz chap-yuqori burchagidan): PDF (`printReceiptPdf.ts`) va
 * brauzer HTML (`printReceiptHtml.ts`) faqat shularni chizadi — ikkala chiqish bitta hisobdan.
 *
 * Bitta buyurtma → bir yoki bir nechta yorliq (`ReceiptLabel`): sig'sa 1 ta, aks holda 1/2 + 2/2 (+ 3/3 …). Yorliqlar
 * ro'yxati keyin sahifalarga teriladi (`composeReceiptPages`) — termalda 1 yorliq = 1 sahifa. T8 (0OUcHZ7R) kategoriya
 * yorlig'ini buyurtma yorliqlaridan keyin shu ro'yxatga qo'shadi.
 *
 * Algoritm (maket 04 «Algoritm — dasturchi uchun»):
 *   sarlavha: № 18 → 16 → 14 → 12 pt, har biriga summa 16 → 14 → 12 pt — birinchi `eni(№) + 5 mm + eni(ramka) ≤ 67,4`
 *             juftlik (ega qarori 2); 12/12 da ham sig'masa oraliq 4 mm.
 *   for P in [P0, P1, P2, P3]:
 *     A: ism, telefon(lar), viloyat · tuman, ko'cha — so'zlab o'raladi; R1 (QR ustuni yonida) ga sig'masa R2 da to'liq
 *        enda davom etadi;
 *     B: chiziq + mahsulotlar + «Izoh: …» — avval R2 boshidan, sig'masa A dan keyin darhol;
 *        k = n … 1 — sig'adigan eng ko'p mahsulot, qolgani «… +N ta mahsulot»; izoh doim to'liq — sig'masa keyingi P.
 *   davomi: 1/2 = A + (sig'sa) qisqa mahsulot + «Davomi 2/2 yorliqda …»; 2/2 = «Manzil:», «Izoh:» to'liq +
 *           «Mahsulotlar (n ta):» sig'gancha; 2/2 ga ham sig'masa — 3/3 (manzil va izoh baribir kesilmaydi).
 */

/* ───────────────────────────── Chizish amallari ───────────────────────────── */

export interface ReceiptTextOp {
  kind: "text";
  /** Chap chekka, mm. */
  x: number;
  /** Bazaviy chiziq, mm. */
  baseline: number;
  /** Shrift o'lchami, pt. */
  pt: number;
  weight: ReceiptWeight;
  text: string;
  /** Oq matn (qora fon ustida). */
  paper?: boolean;
  /** Harflar orasi, mm (CSS `letter-spacing`, jsPDF `charSpace`). */
  letterSpacing?: number;
  /**
   * Kerning (shrift GPOS juftliklari, `measure.kerning`): `[indeks, mm]` — matn shu indeksdan oldin bo'linib, keyingi
   * qismi shuncha suriladi. Joylash `x` larni kerning bilan hisoblagan — rendererlar uni albatta qo'llaydi.
   */
  kern?: ReadonlyArray<ReceiptKern>;
}

/** To'liq qora to'g'ri to'rtburchak (chiziq, qora yorliq). */
export interface ReceiptRectOp {
  kind: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  radius?: number;
}

/** Ramka: tashqi chegarasi `x, y, w, h`, chiziq ichkariga (CSS `border-box`). */
export interface ReceiptFrameOp {
  kind: "frame";
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  stroke: number;
}

/** Punktir (A4 kesish chizig'i): chiziq o'qi `(x1, y1)` → `(x2, y2)`, bo'lak `dash`, oraliq `gap` (boshidan). */
export interface ReceiptDashOp {
  kind: "dash";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: number;
  dash: number;
  gap: number;
}

export interface ReceiptQrOp {
  kind: "qr";
  x: number;
  y: number;
  /** Modul tomoni, mm. */
  module: number;
  symbol: ReceiptQrSymbol;
}

/** Qaychi belgisi (A4 kesish chizig'i boshida; maketdagi lucide `Scissors`, 24 birlikli to'r). */
export interface ReceiptScissorsOp {
  kind: "scissors";
  /** Chap-yuqori burchak, mm. */
  x: number;
  y: number;
  /** Tomoni, mm. */
  size: number;
}

/** lucide `Scissors` (24 birlikli to'r, chiziq 2): halqalar markazi (6, 6) va (6, 18), r 3; chiziqlar [x1, y1, x2, y2]. */
export const SCISSORS_LINES: ReadonlyArray<readonly [number, number, number, number]> = [
  [8.12, 8.12, 12, 12],
  [20, 4, 8.12, 15.88],
  [14.8, 14.8, 20, 20],
];

export type ReceiptOp =
  ReceiptTextOp | ReceiptRectOp | ReceiptFrameOp | ReceiptDashOp | ReceiptQrOp | ReceiptScissorsOp;

/** Joylash qarori (testlar, ui-kit namunasi va T8 uchun). */
export interface ReceiptLabelMeta {
  /** Buyurtma id (davomi yorliqlari ham bir xil). */
  orderId: string;
  part: number;
  parts: number;
  /** Ishlagan pog'ona: `P0` … `P3`; davomida 1/2 — A blok pog'onasi, 2/2… — `P3`. */
  level: "P0" | "P1" | "P2" | "P3";
  numberPt: number;
  /** Summa ramkasi shrifti; ramka yo'q — `null`. */
  amountPt: number | null;
  /** № va ramka orasi, mm. */
  headerGap: number | null;
  /** Yorliqda ko'ringan mahsulotlar soni (k). */
  productsShown: number;
  /** B blok joyi: R2 boshidan yoki A dan keyin darhol; B yo'q — `null`. */
  bPlacement: "r2" | "after-a" | null;
}

export interface ReceiptLabel {
  width: number;
  height: number;
  ops: ReceiptOp[];
  meta?: ReceiptLabelMeta;
}

export interface ReceiptPage {
  width: number;
  height: number;
  ops: ReceiptOp[];
}

/* ───────────────────────────── O'lchamlar (maket, mm) ───────────────────────────── */

interface Zone {
  x: number;
  w: number;
  top: number;
  bottom: number;
}

interface Level {
  id: ReceiptLabelMeta["level"];
  region: number;
  street: number;
  body: number;
}

export interface OrderReceiptSpec {
  width: number;
  height: number;
  /** QR ustuni yonidagi zona. */
  r1: Zone;
  /** QR ostidagi to'liq enli zona (pastki chegarasi — pastki band ustida). */
  r2: Zone;
  header: {
    /** № va ramkaning pastki cheti. */
    bottom: number;
    /** Ramkaning o'ng cheti (= R1 o'ng cheti). */
    right: number;
    numberPts: readonly number[];
    numberLineFactor: number;
    gap: number;
    gapFallback: number;
    rule: { y: number; h: number };
  };
  amount: {
    pts: readonly number[];
    /** Ramka balandligi summa shriftiga ko'ra. */
    heights: Readonly<Record<number, number>>;
    /** «jami …» qatori qo'shilganda balandlik ortishi. */
    partialExtra: number;
    /**
     * Summa qatorining `line-height` i = ramka balandligi − shu (maketdagi CSS: ramka 0,4 + ichki 0,6 mm har tomonda);
     * «jami» bilan — `partialLineGap`. Qator qutisi CSS dagidek hisoblanadi (`amountLineBox`).
     */
    lineGap: number;
    partialLineGap: number;
    /** «jami …» qatori balandligi (CSS `line-height`). */
    totalLine: number;
    labelPt: number;
    labelHeight: number;
    currencyPt: number;
    totalPt: number;
    border: number;
    padX: number;
    radius: number;
  };
  namePts: readonly number[];
  phonePt: number;
  extraPhonePt: number;
  /** Telefonlar va manzil orasi. */
  addressGap: number;
  levels: readonly Level[];
  /** B blok / pastki band chizig'i qalinligi. */
  rule: number;
  /** A tugagach chiziqqacha. */
  ruleAfterA: number;
  /** Chiziqdan matngacha. */
  textAfterRule: number;
  qr: {
    x: number;
    y: number;
    box: number;
    dots: readonly number[];
    missingStroke: number;
    missingPt: number;
  };
  badge: {
    x: number;
    y: number;
    w: number;
    h: number;
    radius: number;
    pt: number;
    tracking: number;
  };
  date: { top: number; lineHeight: number; pt: number };
  footer: {
    ruleY: number;
    top: number;
    lineHeight: number;
    pt: number;
    gap: number;
    minName: number;
  };
  banner: { h: number; radius: number; pt: number; gap: number };
  /** Davomi yorlig'idagi shrift va paragraflar orasi. */
  continuationPt: number;
  paragraphGap: number;
}

/** Termal 100×60 (maket 01, 1 mm = 5 px; R1 = x 2–69,4 · y 13,2–40,8, R2 = x 2–98 · y 42–52,8). */
export const THERMAL_ORDER_SPEC: OrderReceiptSpec = Object.freeze<OrderReceiptSpec>({
  width: 100,
  height: 60,
  r1: { x: 2, w: 67.4, top: 13.2, bottom: 40.8 },
  r2: { x: 2, w: 96, top: 42, bottom: 52.8 },
  header: {
    bottom: 11.4,
    right: 69.4,
    numberPts: [18, 16, 14, 12],
    numberLineFactor: 1.1,
    gap: 5,
    gapFallback: 4,
    rule: { y: 12, h: 0.4 },
  },
  amount: {
    pts: [16, 14, 12],
    heights: { 16: 8, 14: 7.4, 12: 6.6 },
    partialExtra: 1.6,
    lineGap: 2,
    partialLineGap: 4,
    totalLine: 2.8,
    labelPt: 12,
    labelHeight: 6.8,
    currencyPt: 8,
    totalPt: 7,
    border: 0.4,
    padX: 1.2,
    radius: 1.2,
  },
  namePts: [13, 11],
  phonePt: 13,
  extraPhonePt: 11,
  addressGap: 0.8,
  levels: [
    { id: "P0", region: 10, street: 9, body: 8.5 },
    { id: "P1", region: 10, street: 9, body: 7.5 },
    { id: "P2", region: 8.5, street: 8.5, body: 7.5 },
    { id: "P3", region: 7.5, street: 7.5, body: 7.5 },
  ],
  rule: 0.25,
  ruleAfterA: 0.6,
  textAfterRule: 0.8,
  qr: { x: 74, y: 4, box: 21.75, dots: [6, 5, 4], missingStroke: 0.25, missingPt: 8 },
  badge: { x: 72.2, y: 29.6, w: 25.6, h: 6, radius: 1.2, pt: 8.5, tracking: 0.02 },
  date: { top: 36.6, lineHeight: 3.6, pt: 8 },
  footer: { ruleY: 53.6, top: 54.4, lineHeight: 3.6, pt: 8, gap: 2.4, minName: 12 },
  banner: { h: 3.6, radius: 1.2, pt: 8, gap: 0.8 },
  continuationPt: 7.5,
  paragraphGap: 0.8,
});

/**
 * A4 katagi 100×47,5 mm (maket 03, 1 mm = 5 px; ichki chekka 3 mm): termal chekning ixcham ko'rinishi, qoidalar o'sha.
 * Shriftlar «A4 katak» ustunidan (maket 04): № 16 → 14, summa 14 → 12 → 10, pog'onalar 9/8 → 8/7,5 → 7 pt (P0 · P1 —
 * izoh va mahsulot 7,5 → 7), oraliq 4 mm, QR 20 mm. R1 = x 3–72,4 · y 12,4–36,8; R2 (QR ostida) amalda yo'q —
 * pastki band 39,2 mm dan: sig'masa davomi qo'shni katakka (2/2).
 */
export const A4_ORDER_SPEC: OrderReceiptSpec = Object.freeze<OrderReceiptSpec>({
  width: 100,
  height: 47.5,
  r1: { x: 3, w: 69.4, top: 12.4, bottom: 36.8 },
  r2: { x: 3, w: 94, top: 38, bottom: 38.4 },
  header: {
    bottom: 10.8,
    right: 72.4,
    numberPts: [16, 14],
    numberLineFactor: 1.1,
    gap: 4,
    gapFallback: 4,
    rule: { y: 11.4, h: 0.4 },
  },
  amount: {
    pts: [14, 12, 10],
    heights: { 14: 7.4, 12: 6.6, 10: 5.8 },
    partialExtra: 1.6,
    lineGap: 2,
    partialLineGap: 4,
    totalLine: 2.8,
    labelPt: 10,
    labelHeight: 6,
    currencyPt: 7,
    totalPt: 7,
    border: 0.4,
    padX: 1,
    radius: 1.2,
  },
  namePts: [10, 9],
  phonePt: 10,
  extraPhonePt: 8,
  addressGap: 0.8,
  levels: [
    { id: "P0", region: 9, street: 8, body: 7.5 },
    { id: "P1", region: 9, street: 8, body: 7 },
    { id: "P2", region: 8, street: 7.5, body: 7 },
    { id: "P3", region: 7, street: 7, body: 7 },
  ],
  rule: 0.2,
  ruleAfterA: 0.6,
  textAfterRule: 0.8,
  qr: { x: 76.4, y: 3.4, box: 20, dots: [], missingStroke: 0.2, missingPt: 7 },
  badge: { x: 75.2, y: 27.2, w: 22.4, h: 5, radius: 1.2, pt: 7, tracking: 0.02 },
  date: { top: 33, lineHeight: 3.2, pt: 7.5 },
  footer: { ruleY: 39.2, top: 40.8, lineHeight: 3.2, pt: 7, gap: 2, minName: 12 },
  banner: { h: 3.2, radius: 1, pt: 7, gap: 0.6 },
  continuationPt: 7,
  paragraphGap: 0.6,
});

/* ───────────────────────────── Yordamchilar ───────────────────────────── */

const EPS = 1e-6;
const ELLIPSIS = "…";

const sizeMm = (pt: number) => pt * MM_PER_PT;

/**
 * Qator balandligi — maketdagidek: shrift px (1 mm = 5 px) 0,1 px gacha, × koeffitsient, butun px ga (0,2 mm to'r).
 * 13 pt → 5,4 mm; 10 pt → 4,2; 9 pt → 3,8; 8,5 pt → 3,6; 7,5 pt → 3,2; № 18 pt (×1,1) → 7,0.
 */
export const receiptLineHeight = (pt: number, factor = 1.2) => {
  const px = Math.round(pt * MM_PER_PT * 50) / 10;
  return Math.round(px * factor) / 5;
};

/** CSS qator qutisidagi bazaviy chiziq: markaz + (ascent − descent) / 2 × o'lcham. */
const baselineAtCenter = (center: number, pt: number) =>
  center + ((RECEIPT_FONT_METRICS.ascent - RECEIPT_FONT_METRICS.descent) / 2) * sizeMm(pt);

const baselineOf = (top: number, lineHeight: number, pt: number) =>
  baselineAtCenter(top + lineHeight / 2, pt);

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Matn bo'lagi (bitta qalinlik). */
interface Span {
  text: string;
  weight: ReceiptWeight;
}

/** So'z (yoki bo'linmas guruh: telefon, «nom ×2»). Undan keyingi bo'sh joy shu so'z qalinligida o'lchanadi. */
interface Token {
  text: string;
  weight: ReceiptWeight;
}

const words = (text: string) => text.split(" ").filter(Boolean);

/** Bo'laklar → so'zlar. `glue` — so'zni oldingisiga yopishtirish (masalan «×2» nomdan ajralmasin). */
const tokenize = (spans: Span[], glue?: (word: string) => boolean): Token[] => {
  const tokens: Token[] = [];
  for (const span of spans) {
    for (const word of words(span.text)) {
      const last = tokens[tokens.length - 1];
      if (last && glue?.(word) && last.weight === span.weight) last.text += ` ${word}`;
      else tokens.push({ text: word, weight: span.weight });
    }
  }
  return tokens;
};

interface PlacedLine {
  x: number;
  top: number;
  /** Qator joyining eni (R1 yoki to'liq en). */
  width: number;
  lineHeight: number;
  pt: number;
  tokens: Token[];
}

/**
 * Qatordagi so'zlarni bir xil qalinlikdagi bo'laklarga birlashtirib chizish amallari. So'zlar orasidagi bo'sh joy oldingi
 * bo'lak qalinligida o'lchanadi (maketdagi `<b>Izoh: </b>…` kabi) — `tokensWidth` bilan bir xil.
 */
const lineOps = (line: PlacedLine, measure: ReceiptMeasure, out: ReceiptOp[]) => {
  const baseline = round3(baselineOf(line.top, line.lineHeight, line.pt));
  const spans: Span[] = [];
  for (const token of line.tokens) {
    const last = spans[spans.length - 1];
    if (last && last.weight === token.weight) {
      last.text += ` ${token.text}`;
    } else {
      if (last) last.text += " ";
      spans.push({ text: token.text, weight: token.weight });
    }
  }
  let x = line.x;
  for (const span of spans) {
    out.push({
      kind: "text",
      x: round3(x),
      baseline,
      pt: line.pt,
      weight: span.weight,
      text: span.text.trimEnd(),
    });
    x += measure(span.text, line.pt, span.weight);
  }
};

/**
 * Qator kengligi — `lineOps` chizganidek: bir xil qalinlikdagi so'zlar bitta bo'lak, bo'lak oxiridagi bo'sh joy shu
 * bo'lak qalinligida (kerning bo'lak ichida — «L », «T » juftliklari ham).
 */
const tokensWidth = (tokens: Token[], pt: number, measure: ReceiptMeasure) => {
  let width = 0;
  let text = "";
  let weight: ReceiptWeight | null = null;
  for (const token of tokens) {
    if (weight === null) {
      text = token.text;
      weight = token.weight;
    } else if (token.weight === weight) {
      text += ` ${token.text}`;
    } else {
      width += measure(`${text} `, pt, weight);
      text = token.text;
      weight = token.weight;
    }
  }
  return weight === null ? 0 : width + measure(text, pt, weight);
};

/** Juda uzun so'z (URL, uzun raqam) — qatorga sig'adigan bo'laklarga (matn kesilmaydi, bo'linadi). */
const splitLongToken = (
  token: Token,
  width: number,
  pt: number,
  measure: ReceiptMeasure,
): Token[] => {
  const parts: Token[] = [];
  let part = "";
  for (const char of token.text) {
    if (part && measure(part + char, pt, token.weight) > width + EPS) {
      parts.push({ text: part, weight: token.weight });
      part = char;
    } else {
      part += char;
    }
  }
  if (part) parts.push({ text: part, weight: token.weight });
  return parts;
};

interface Slot {
  x: number;
  top: number;
  width: number;
}

/**
 * Oqim: qator R1 ga sig'sa — R1 enida; sig'masa R1 tagidan (40,8 mm) to'liq enda davom etadi. `y` — keyingi qator
 * boshi. Sahifa chegarasi (`limit`) dan oshganini chaqiruvchi tekshiradi.
 */
class Flow {
  y: number;
  private readonly r1: Zone;
  private readonly r2: Zone;

  constructor(r1: Zone, r2: Zone, y: number) {
    this.r1 = r1;
    this.r2 = r2;
    this.y = y;
  }

  peek(lineHeight: number): Slot {
    if (this.y + lineHeight <= this.r1.bottom + EPS)
      return { x: this.r1.x, top: this.y, width: this.r1.w };
    return { x: this.r2.x, top: Math.max(this.y, this.r1.bottom), width: this.r2.w };
  }

  take(lineHeight: number): Slot {
    const slot = this.peek(lineHeight);
    this.y = slot.top + lineHeight;
    return slot;
  }

  clone() {
    return new Flow(this.r1, this.r2, this.y);
  }
}

/** Paragrafni oqimga so'zlab o'raydi. `limit` berilsa — undan oshadigan qator joylanmaydi (`overflow` qaytadi). */
const flowParagraph = (
  flow: Flow,
  tokens: Token[],
  pt: number,
  measure: ReceiptMeasure,
  limit = Infinity,
): { lines: PlacedLine[]; overflow: Token[] | null } => {
  const lineHeight = receiptLineHeight(pt);
  const lines: PlacedLine[] = [];
  const queue = [...tokens];
  while (queue.length) {
    const slot = flow.peek(lineHeight);
    if (slot.top + lineHeight > limit + EPS) return { lines, overflow: queue };
    const line: Token[] = [];
    while (queue.length) {
      const next = queue[0];
      if (tokensWidth([...line, next], pt, measure) <= slot.width + EPS) {
        line.push(next);
        queue.shift();
        continue;
      }
      if (line.length === 0) {
        // Bitta so'z qatordan uzun — bo'linadi.
        const [head, ...rest] = splitLongToken(next, slot.width, pt, measure);
        line.push(head);
        queue.splice(0, 1, ...rest);
      }
      break;
    }
    flow.take(lineHeight);
    lines.push({ x: slot.x, top: slot.top, width: slot.width, lineHeight, pt, tokens: line });
  }
  return { lines, overflow: null };
};

/** Bitta qator, so'z bo'yicha qisqartirish («Abdurahmonova Mohinur…»): birinchi so'z doim to'liq qoladi. */
const ellipsizeWords = (
  text: string,
  width: number,
  pt: number,
  weight: ReceiptWeight,
  measure: ReceiptMeasure,
) => {
  if (measure(text, pt, weight) <= width + EPS) return text;
  const parts = words(text);
  for (let count = parts.length - 1; count >= 1; count -= 1) {
    const candidate = `${parts
      .slice(0, count)
      .join(" ")
      .replace(/[\s,.;:-]+$/u, "")}${ELLIPSIS}`;
    if (count === 1 || measure(candidate, pt, weight) <= width + EPS) return candidate;
  }
  return text;
};

/** Belgi bo'yicha qisqartirish (market nomi — CSS `text-overflow: ellipsis` kabi). */
const ellipsizeChars = (
  text: string,
  width: number,
  pt: number,
  weight: ReceiptWeight,
  measure: ReceiptMeasure,
) => {
  if (measure(text, pt, weight) <= width + EPS) return text;
  const chars = Array.from(text);
  for (let count = chars.length - 1; count >= 1; count -= 1) {
    const candidate = `${chars.slice(0, count).join("").trimEnd()}${ELLIPSIS}`;
    if (measure(candidate, pt, weight) <= width + EPS) return candidate;
  }
  return ELLIPSIS;
};

/**
 * Matn amallariga kerning joylarini yozadi (`measure.kerning`): joylash kengliklarni kerning bilan o'lchagan —
 * rendererlar ham aynan shu joylarda suradi. T8 kategoriya yorlig'i ham o'z amallarini shundan o'tkazadi.
 */
export const withReceiptKerning = (ops: ReceiptOp[], measure: ReceiptMeasure): ReceiptOp[] => {
  const { kerning } = measure;
  if (!kerning) return ops;
  return ops.map((op) => {
    if (op.kind !== "text") return op;
    const kern = kerning(op.text, op.pt, op.weight);
    return kern.length ? { ...op, kern } : op;
  });
};

/** Matn kerning joylarida bo'laklarga (rendererlar uchun): `[bo'lak, undan keyingi surish (mm)]`. */
export const splitReceiptKerned = (
  op: Pick<ReceiptTextOp, "text" | "kern">,
): Array<[text: string, offset: number]> => {
  if (!op.kern?.length) return [[op.text, 0]];
  const parts: Array<[string, number]> = [];
  let start = 0;
  for (const [index, offset] of op.kern) {
    if (index <= start || index >= op.text.length) continue;
    parts.push([op.text.slice(start, index), offset]);
    start = index;
  }
  parts.push([op.text.slice(start), 0]);
  return parts;
};

/** Paket cheki (`printReceiptPackage.ts`) ham shu o'lchov va qisqartirish qoidalari bilan joylanadi. */
export {
  baselineAtCenter as receiptBaselineAtCenter,
  baselineOf as receiptBaseline,
  ellipsizeChars as ellipsizeReceiptChars,
  round3 as roundReceiptMm,
};

const joinUz = (parts: string[]) =>
  parts.length <= 1
    ? (parts[0] ?? "")
    : `${parts.slice(0, -1).join(", ")} va ${parts[parts.length - 1]}`;

/* ───────────────────────────── Sarlavha: № va summa ───────────────────────────── */

export interface ReceiptHeaderFit {
  numberPt: number;
  amountPt: number | null;
  boxWidth: number;
  boxHeight: number;
  gap: number | null;
}

const amountSizes = (amount: ReceiptAmount, spec: OrderReceiptSpec) =>
  amount.kind === "label" ? [spec.amount.labelPt] : spec.amount.pts;

/** Ramka eni: summa + « so'm» (8 pt) yoki «jami …» (7 pt) dan kengi + 2 × (chiziq + ichki chekka) = + 3,2 mm. */
const amountBox = (
  amount: ReceiptAmount,
  pt: number,
  spec: OrderReceiptSpec,
  measure: ReceiptMeasure,
) => {
  const inset = 2 * (spec.amount.border + spec.amount.padX);
  if (amount.kind === "label") {
    return { width: measure(amount.text, pt, 700) + inset, height: spec.amount.labelHeight };
  }
  const main =
    measure(amount.value, pt, 700) +
    measure(` ${RECEIPT_TEXT.currency}`, spec.amount.currencyPt, 700);
  const total = amount.total
    ? measure(`${RECEIPT_TEXT.total} ${amount.total}`, spec.amount.totalPt, 600)
    : 0;
  const base =
    spec.amount.heights[pt] ?? spec.amount.heights[spec.amount.pts[spec.amount.pts.length - 1]];
  return {
    width: Math.max(main, total) + inset,
    height: base + (amount.total ? spec.amount.partialExtra : 0),
  };
};

/**
 * Ega qarori 2: № 18 → 16 → 14 → 12, har biriga summa 16 → 14 → 12; birinchi `eni(№) + 5 mm + eni(ramka) ≤ 67,4` juftlik.
 * 12/12 da ham sig'masa — oraliq 4 mm (baribir sig'masa ham 12/12: № va summa kesilmaydi).
 */
export const fitReceiptHeader = (
  ref: string,
  amount: ReceiptAmount | null,
  measure: ReceiptMeasure,
  spec: OrderReceiptSpec = THERMAL_ORDER_SPEC,
): ReceiptHeaderFit => {
  const width = spec.header.right - spec.r1.x;
  const pts = spec.header.numberPts;
  if (!amount) {
    // Pul maydoni yo'q (LOGIST): ramka chizilmaydi, № faqat o'z zonasiga sig'ishi kerak.
    const numberPt = pts.find((pt) => measure(ref, pt, 700) <= width + EPS) ?? pts[pts.length - 1];
    return { numberPt, amountPt: null, boxWidth: 0, boxHeight: 0, gap: null };
  }
  const sizes = amountSizes(amount, spec);
  for (const numberPt of pts) {
    const numberWidth = measure(ref, numberPt, 700);
    for (const amountPt of sizes) {
      const box = amountBox(amount, amountPt, spec, measure);
      const gap = width - numberWidth - box.width;
      if (gap >= spec.header.gap - EPS) {
        return { numberPt, amountPt, boxWidth: box.width, boxHeight: box.height, gap };
      }
    }
  }
  const numberPt = pts[pts.length - 1];
  const amountPt = sizes[sizes.length - 1];
  const box = amountBox(amount, amountPt, spec, measure);
  return {
    numberPt,
    amountPt,
    boxWidth: box.width,
    boxHeight: box.height,
    gap: width - measure(ref, numberPt, 700) - box.width,
  };
};

/**
 * Summa ramkasidagi qatorlar bazaviy chizig'i — maketdagi CSS bilan bir xil (flex ustun, markazda): summa qatori
 * `line-height = h − lineGap`, uning ichidagi kichik «so'm» qator qutisini pastga kengaytiradi (har ikkisida o'sha
 * `line-height`), qisman to'langanda ostida «jami …» qatori (`totalLine`). Shuning uchun summa ramka markazidan biroz
 * yuqorida turadi (16 pt da 0,5 mm).
 */
const amountLineBox = (
  amount: Extract<ReceiptAmount, { kind: "collect" }>,
  fit: ReceiptHeaderFit,
  y: number,
  spec: OrderReceiptSpec,
) => {
  const box = spec.amount;
  const pt = fit.amountPt ?? box.pts[0];
  // CSS qator qutisi: bazaviy chiziq ustida (L + (ascent − descent) · o'lcham) / 2, ostida (L − …) / 2.
  const shift = (size: number) =>
    (RECEIPT_FONT_METRICS.ascent - RECEIPT_FONT_METRICS.descent) * size;
  const line = fit.boxHeight - (amount.total ? box.partialLineGap : box.lineGap);
  const lineBox = line + Math.max(0, shift(sizeMm(pt)) - shift(sizeMm(box.currencyPt))) / 2;
  const content = lineBox + (amount.total ? box.totalLine : 0);
  const top = y + box.border + (fit.boxHeight - 2 * box.border - content) / 2;
  return {
    value: top + (line + shift(sizeMm(pt))) / 2,
    total: top + lineBox + (box.totalLine + shift(sizeMm(box.totalPt))) / 2,
  };
};

const headerOps = (
  ref: string,
  amount: ReceiptAmount | null,
  spec: OrderReceiptSpec,
  measure: ReceiptMeasure,
  out: ReceiptOp[],
): ReceiptHeaderFit => {
  const fit = fitReceiptHeader(ref, amount, measure, spec);
  const { header, amount: box } = spec;
  const numberLine = receiptLineHeight(fit.numberPt, header.numberLineFactor);
  out.push({
    kind: "text",
    x: spec.r1.x,
    baseline: round3(baselineOf(header.bottom - numberLine, numberLine, fit.numberPt)),
    pt: fit.numberPt,
    weight: 700,
    text: ref,
  });
  if (amount && fit.amountPt !== null) {
    const x = header.right - fit.boxWidth;
    const y = header.bottom - fit.boxHeight;
    out.push({
      kind: "frame",
      x: round3(x),
      y: round3(y),
      w: round3(fit.boxWidth),
      h: round3(fit.boxHeight),
      radius: box.radius,
      stroke: box.border,
    });
    const right = header.right - box.border - box.padX;
    if (amount.kind === "label") {
      const width = measure(amount.text, fit.amountPt, 700);
      out.push({
        kind: "text",
        x: round3(right - width),
        baseline: round3(baselineAtCenter(y + fit.boxHeight / 2, fit.amountPt)),
        pt: fit.amountPt,
        weight: 700,
        text: amount.text,
      });
    } else {
      const currency = ` ${RECEIPT_TEXT.currency}`;
      const currencyWidth = measure(currency, box.currencyPt, 700);
      const valueWidth = measure(amount.value, fit.amountPt, 700);
      const lines = amountLineBox(amount, fit, y, spec);
      const baseline = round3(lines.value);
      out.push({
        kind: "text",
        x: round3(right - currencyWidth - valueWidth),
        baseline,
        pt: fit.amountPt,
        weight: 700,
        text: amount.value,
      });
      out.push({
        kind: "text",
        x: round3(right - currencyWidth),
        baseline,
        pt: box.currencyPt,
        weight: 700,
        text: currency,
      });
      if (amount.total) {
        const total = `${RECEIPT_TEXT.total} ${amount.total}`;
        out.push({
          kind: "text",
          x: round3(right - measure(total, box.totalPt, 600)),
          baseline: round3(lines.total),
          pt: box.totalPt,
          weight: 600,
          text: total,
        });
      }
    }
  }
  out.push({
    kind: "rect",
    x: spec.r1.x,
    y: header.rule.y,
    w: round3(header.right - spec.r1.x),
    h: header.rule.h,
  });
  return fit;
};

/* ───────────────────────────── QR, yetkazish turi, sana, pastki band ───────────────────────────── */

const qrOps = (
  symbol: ReceiptQrSymbol | null,
  spec: OrderReceiptSpec,
  measure: ReceiptMeasure,
  out: ReceiptOp[],
) => {
  const { qr } = spec;
  if (!symbol) {
    out.push({
      kind: "frame",
      x: qr.x,
      y: qr.y,
      w: qr.box,
      h: qr.box,
      radius: 0,
      stroke: qr.missingStroke,
    });
    const width = measure(RECEIPT_TEXT.noQr, qr.missingPt, 700);
    out.push({
      kind: "text",
      x: round3(qr.x + (qr.box - width) / 2),
      baseline: round3(baselineAtCenter(qr.y + qr.box / 2, qr.missingPt)),
      pt: qr.missingPt,
      weight: 700,
      text: RECEIPT_TEXT.noQr,
    });
    return;
  }
  const module = receiptQrModule(symbol.count, qr.box, qr.dots);
  const offset = (qr.box - module * symbol.count) / 2;
  out.push({ kind: "qr", x: round3(qr.x + offset), y: round3(qr.y + offset), module, symbol });
};

const badgeOps = (
  text: string,
  spec: OrderReceiptSpec,
  measure: ReceiptMeasure,
  out: ReceiptOp[],
) => {
  const { badge } = spec;
  out.push({ kind: "rect", x: badge.x, y: badge.y, w: badge.w, h: badge.h, radius: badge.radius });
  const letterSpacing = round3(badge.tracking * sizeMm(badge.pt));
  const width = measure(text, badge.pt, 700) + letterSpacing * Array.from(text).length;
  out.push({
    kind: "text",
    x: round3(badge.x + (badge.w - width) / 2),
    baseline: round3(baselineAtCenter(badge.y + badge.h / 2, badge.pt)),
    pt: badge.pt,
    weight: 700,
    text,
    paper: true,
    letterSpacing,
  });
};

const dateOps = (
  text: string,
  spec: OrderReceiptSpec,
  measure: ReceiptMeasure,
  out: ReceiptOp[],
) => {
  if (!text) return;
  const { badge, date } = spec;
  const width = measure(text, date.pt, 700);
  out.push({
    kind: "text",
    x: round3(badge.x + (badge.w - width) / 2),
    baseline: round3(baselineOf(date.top, date.lineHeight, date.pt)),
    pt: date.pt,
    weight: 700,
    text,
  });
};

interface FooterPlan {
  /** R2 pastki chegarasi (ikki qatorli bandda 3,6 mm yuqoriroq). */
  r2Bottom: number;
  ops: ReceiptOp[];
}

/**
 * Pastki band (maket 10-band): chapda «Jo'natuvchi: market», o'ngda «Muammo bo'lsa: telefon» — o'ng qism hech qachon
 * kesilmaydi, market nomi «…» bilan qisqaradi. Ikki raqam sig'masa (ega qarori 4) band 2 qatorga o'tadi, R2 qisqaradi.
 */
const planFooter = (
  model: ReceiptOrderModel,
  spec: OrderReceiptSpec,
  measure: ReceiptMeasure,
): FooterPlan => {
  const { footer, r2 } = spec;
  const ops: ReceiptOp[] = [];
  const left = model.sender ? { label: `${RECEIPT_TEXT.sender} `, value: model.sender } : null;
  const right = model.contacts.length
    ? { label: `${RECEIPT_TEXT.contact} `, value: model.contacts.join(", ") }
    : null;
  if (!left && !right) return { r2Bottom: r2.bottom, ops };

  const rightWidth = right
    ? measure(right.label, footer.pt, 500) + measure(right.value, footer.pt, 700)
    : 0;
  const leftLabelWidth = left ? measure(left.label, footer.pt, 500) : 0;
  const fullLeft = right ? r2.w - rightWidth - footer.gap : r2.w;
  const twoLines = Boolean(
    left &&
    right &&
    leftLabelWidth + measure(left.value, footer.pt, 700) > fullLeft + EPS &&
    fullLeft - leftLabelWidth < footer.minName,
  );
  const shift = twoLines ? footer.lineHeight : 0;
  ops.push({ kind: "rect", x: r2.x, y: round3(footer.ruleY - shift), w: r2.w, h: spec.rule });

  const leftTop = footer.top - shift;
  if (left) {
    const room = (twoLines ? r2.w : fullLeft) - leftLabelWidth;
    const value = ellipsizeChars(left.value, room, footer.pt, 700, measure);
    const baseline = round3(baselineOf(leftTop, footer.lineHeight, footer.pt));
    ops.push({
      kind: "text",
      x: r2.x,
      baseline,
      pt: footer.pt,
      weight: 500,
      text: left.label.trimEnd(),
    });
    ops.push({
      kind: "text",
      x: round3(r2.x + leftLabelWidth),
      baseline,
      pt: footer.pt,
      weight: 700,
      text: value,
    });
  }
  if (right) {
    const baseline = round3(baselineOf(footer.top, footer.lineHeight, footer.pt));
    const x = r2.x + r2.w - rightWidth;
    ops.push({
      kind: "text",
      x: round3(x),
      baseline,
      pt: footer.pt,
      weight: 500,
      text: right.label.trimEnd(),
    });
    ops.push({
      kind: "text",
      x: round3(x + measure(right.label, footer.pt, 500)),
      baseline,
      pt: footer.pt,
      weight: 700,
      text: right.value,
    });
  }
  return { r2Bottom: r2.bottom - shift, ops };
};

/* ───────────────────────────── A va B bloklar ───────────────────────────── */

interface BlockResult {
  lines: PlacedLine[];
  /** Chiziq va boshqa matn bo'lmagan amallar. */
  ops: ReceiptOp[];
  /** Oxirgi qator pastki cheti. */
  end: number;
}

const blockOps = (block: BlockResult, measure: ReceiptMeasure) => {
  const ops = [...block.ops];
  block.lines.forEach((line) => lineOps(line, measure, ops));
  return ops;
};

/** A blok: ism, telefon(lar), viloyat · tuman, ko'cha. `limit` dan oshgan qator joylanmaydi — `overflow: true`. */
const layoutA = (
  model: ReceiptOrderModel,
  level: Level,
  spec: OrderReceiptSpec,
  measure: ReceiptMeasure,
  limit: number,
): { result: BlockResult; overflow: boolean } => {
  const flow = new Flow(spec.r1, spec.r2, spec.r1.top);
  const lines: PlacedLine[] = [];
  let overflow = false;
  const place = (tokens: Token[], pt: number) => {
    if (overflow) return;
    const placed = flowParagraph(flow, tokens, pt, measure, limit);
    lines.push(...placed.lines);
    if (placed.overflow) overflow = true;
  };

  if (model.name) {
    const [big, small] = spec.namePts;
    const fitsBig = measure(model.name, big, 700) <= spec.r1.w + EPS;
    const pt = fitsBig ? big : small;
    const text = fitsBig ? model.name : ellipsizeWords(model.name, spec.r1.w, small, 700, measure);
    place([{ text, weight: 700 }], pt);
  }
  if (model.phone) place([{ text: model.phone, weight: 700 }], spec.phonePt);
  if (model.extraPhone) place([{ text: model.extraPhone, weight: 700 }], spec.extraPhonePt);
  if ((model.region || model.street) && flow.y > spec.r1.top + EPS) flow.y += spec.addressGap;
  if (model.region) place(tokenize([{ text: model.region, weight: 700 }]), level.region);
  if (model.street) place(tokenize([{ text: model.street, weight: 500 }]), level.street);

  const end = lines.length
    ? Math.max(...lines.map((line) => line.top + line.lineHeight))
    : spec.r1.top;
  return { result: { lines, ops: [], end }, overflow };
};

const productsText = (products: string[], shown: number, tail: (rest: number) => string) => {
  const head = products.slice(0, shown).join(", ");
  const rest = products.length - shown;
  return rest > 0 ? `${head} ${ELLIPSIS} ${tail(rest)}` : head;
};

/** «×2» oldingi so'zdan ajralmaydi. */
const glueQuantity = (word: string) => word.startsWith("×");

const productTokens = (
  products: string[],
  shown: number,
  tail: (rest: number) => string,
  label?: string,
) =>
  tokenize(
    [
      ...(label ? [{ text: label, weight: 700 as const }] : []),
      { text: productsText(products, shown, tail), weight: 600 },
    ],
    glueQuantity,
  );

const commentTokens = (comment: string) =>
  tokenize([
    { text: RECEIPT_TEXT.comment, weight: 700 },
    { text: comment, weight: 500 },
  ]);

/** B blok chizig'i: R1 ichida bo'lsa R1 enida, pastda — to'liq enda. */
const bRuleOp = (y: number, spec: OrderReceiptSpec): ReceiptRectOp => ({
  kind: "rect",
  x: spec.r1.x,
  y: round3(y),
  w: y < spec.r1.bottom - EPS ? spec.r1.w : spec.r2.w,
  h: spec.rule,
});

const layoutB = (
  model: ReceiptOrderModel,
  level: Level,
  shown: number,
  placement: "r2" | "after-a",
  aEnd: number,
  r2Bottom: number,
  spec: OrderReceiptSpec,
  measure: ReceiptMeasure,
): BlockResult | null => {
  const r2RuleY = spec.r2.top - spec.textAfterRule;
  let ruleY: number;
  if (placement === "r2") {
    if (aEnd + spec.ruleAfterA > r2RuleY + EPS) return null;
    ruleY = r2RuleY;
  } else {
    ruleY = aEnd + spec.ruleAfterA;
  }
  const flow = new Flow(spec.r1, spec.r2, ruleY + spec.textAfterRule);
  const lines: PlacedLine[] = [];
  if (model.products.length) {
    const placed = flowParagraph(
      flow,
      productTokens(model.products, shown, (rest) => `+${rest} ta mahsulot`),
      level.body,
      measure,
      r2Bottom,
    );
    if (placed.overflow) return null;
    lines.push(...placed.lines);
  }
  if (model.comment) {
    const placed = flowParagraph(flow, commentTokens(model.comment), level.body, measure, r2Bottom);
    if (placed.overflow) return null;
    lines.push(...placed.lines);
  }
  return { lines, ops: [bRuleOp(ruleY, spec)], end: flow.y };
};

/* ───────────────────────────── Davomi (1/2 + 2/2 …) ───────────────────────────── */

interface ContinuationPage {
  ops: ReceiptOp[];
  productsShown: number;
}

/**
 * 2/2 … sahifalari: «Manzil:», «Izoh:» to'liq (sahifadan sahifaga o'tadi), «Mahsulotlar (n ta):» — sig'gancha
 * (`… +N ta — to'liq ro'yxat ilovada`). Hammasi 7,5 pt.
 */
const layoutContinuation = (
  model: ReceiptOrderModel,
  r2Bottom: number,
  spec: OrderReceiptSpec,
  measure: ReceiptMeasure,
): ContinuationPage[] => {
  const pt = spec.continuationPt;
  const pages: ContinuationPage[] = [];
  let flow = new Flow(spec.r1, spec.r2, spec.r1.top);
  let ops: ReceiptOp[] = [];
  let shownTotal = 0;
  const newPage = () => {
    pages.push({ ops, productsShown: shownTotal });
    flow = new Flow(spec.r1, spec.r2, spec.r1.top);
    ops = [];
    shownTotal = 0;
  };
  const fresh = () => flow.y <= spec.r1.top + EPS;

  /** `gap: false` — oldingi paragraf davomi (yangi qatordan, oraliqsiz). */
  const flowAcrossPages = (tokens: Token[], gap = true) => {
    if (gap && !fresh()) flow.y += spec.paragraphGap;
    let queue = tokens;
    for (;;) {
      const placed = flowParagraph(flow, queue, pt, measure, r2Bottom);
      placed.lines.forEach((line) => lineOps(line, measure, ops));
      if (!placed.overflow) return;
      queue = placed.overflow;
      newPage();
    }
  };

  // «Manzil: viloyat · tuman,» — ko'cha yangi qatordan (maket 2/2; 1/2 dagi A blok tartibi bilan bir xil).
  if (model.region || model.street) {
    const label = { text: RECEIPT_TEXT.address, weight: 700 as const };
    if (model.region) {
      flowAcrossPages(
        tokenize([label, { text: model.street ? `${model.region},` : model.region, weight: 600 }]),
      );
    }
    if (model.street) {
      flowAcrossPages(
        tokenize([...(model.region ? [] : [label]), { text: model.street, weight: 600 }]),
        !model.region,
      );
    }
  }
  if (model.comment) flowAcrossPages(commentTokens(model.comment));

  const n = model.products.length;
  if (n) {
    const label = `Mahsulotlar (${n} ta):`;
    const tail = (rest: number) => `+${rest} ta — to'liq ro'yxat ilovada`;
    const tryPlace = (): boolean => {
      const start = flow.clone();
      if (!fresh()) start.y += spec.paragraphGap;
      for (let shown = n; shown >= 1; shown -= 1) {
        const attempt = start.clone();
        const placed = flowParagraph(
          attempt,
          productTokens(model.products, shown, tail, label),
          pt,
          measure,
          r2Bottom,
        );
        if (!placed.overflow) {
          placed.lines.forEach((line) => lineOps(line, measure, ops));
          flow = attempt;
          shownTotal = shown;
          return true;
        }
      }
      return false;
    };
    if (!tryPlace()) {
      if (!fresh()) newPage();
      if (!tryPlace()) {
        // Bitta mahsulot nomi ham sahifaga sig'maydi (juda uzun) — sahifadan sahifaga o'tadi.
        flowAcrossPages(productTokens(model.products, 1, tail, label));
        shownTotal = 1;
      }
    }
  }
  if (ops.length || pages.length === 0) pages.push({ ops, productsShown: shownTotal });
  return pages;
};

/* ───────────────────────────── Buyurtma cheki ───────────────────────────── */

export interface ReceiptLayoutContext {
  measure: ReceiptMeasure;
  /** QR kodlovchi (sukut — `encodeReceiptQr`). */
  qr?: (token: string | null) => ReceiptQrSymbol | null;
}

interface FixedParts {
  ref: string;
  amount: ReceiptAmount | null;
  date: string;
}

/**
 * B blok urinishlari (maket 04): «avval R2 boshidan (hammasi sig'sa); aks holda A dan keyin darhol, k = n … 1». R2
 * boshidan faqat barcha mahsulotlar bilan; qisqartirilgan ro'yxat — A dan keyin (maket «Uzun ism…»: chiziq 41,0 mm).
 * Oxirida — R2 boshidan qisqartirilgan (A dan keyingi qatorlar R1 enida tor bo'lib sig'magan kamdan-kam holat).
 */
const bAttempts = (counts: number[]): Array<readonly [number, "r2" | "after-a"]> => [
  [counts[0], "r2"],
  ...counts.map((shown) => [shown, "after-a"] as const),
  ...counts.slice(1).map((shown) => [shown, "r2"] as const),
];

/** Har yorliqdagi qat'iy qismlar: sarlavha, QR, yetkazish turi, sana, pastki band. */
const fixedOps = (
  model: ReceiptOrderModel,
  parts: FixedParts,
  qr: ReceiptQrSymbol | null,
  footer: FooterPlan,
  spec: OrderReceiptSpec,
  measure: ReceiptMeasure,
  out: ReceiptOp[],
) => {
  const fit = headerOps(parts.ref, parts.amount, spec, measure, out);
  qrOps(qr, spec, measure, out);
  badgeOps(model.delivery, spec, measure, out);
  dateOps(parts.date, spec, measure, out);
  out.push(...footer.ops);
  return fit;
};

const partDate = (date: string, part: number, parts: number) =>
  parts > 1 ? [`${part}/${parts}`, date].filter(Boolean).join(" · ") : date;

/**
 * Buyurtma → yorliq(lar). Sig'sa — bitta (P0 … P3); P3 da ham sig'masa — 1/2 + 2/2 (+ 3/3 …), ikkalasida bir xil QR.
 */
export const layoutOrderReceipt = (
  model: ReceiptOrderModel,
  context: ReceiptLayoutContext,
  spec: OrderReceiptSpec = THERMAL_ORDER_SPEC,
): ReceiptLabel[] => {
  const { measure } = context;
  const qr = (context.qr ?? encodeReceiptQr)(model.qrToken);
  const footer = planFooter(model, spec, measure);
  const r2Bottom = footer.r2Bottom;
  const label = (ops: ReceiptOp[], meta: ReceiptLabelMeta): ReceiptLabel => ({
    width: spec.width,
    height: spec.height,
    ops: withReceiptKerning(ops, measure),
    meta,
  });
  const hasB = model.products.length > 0 || Boolean(model.comment);
  const counts = model.products.length
    ? Array.from({ length: model.products.length }, (_, i) => model.products.length - i)
    : [0];

  for (const level of spec.levels) {
    const a = layoutA(model, level, spec, measure, r2Bottom);
    if (a.overflow) continue;
    let b: { block: BlockResult; shown: number; placement: "r2" | "after-a" } | null = null;
    if (hasB) {
      for (const [shown, placement] of bAttempts(counts)) {
        const block = layoutB(
          model,
          level,
          shown,
          placement,
          a.result.end,
          r2Bottom,
          spec,
          measure,
        );
        if (block) {
          b = { block, shown, placement };
          break;
        }
      }
      if (!b) continue;
    }
    const ops: ReceiptOp[] = [];
    const fit = fixedOps(
      model,
      { ref: model.ref, amount: model.amount, date: model.date },
      qr,
      footer,
      spec,
      measure,
      ops,
    );
    ops.push(...blockOps(a.result, measure), ...(b ? blockOps(b.block, measure) : []));
    return [
      label(ops, {
        orderId: model.id,
        part: 1,
        parts: 1,
        level: level.id,
        numberPt: fit.numberPt,
        amountPt: fit.amountPt,
        headerGap: fit.gap,
        productsShown: b?.shown ?? 0,
        bPlacement: b?.placement ?? null,
      }),
    ];
  }

  return layoutWithContinuation(model, qr, footer, spec, measure, label);
};

const layoutWithContinuation = (
  model: ReceiptOrderModel,
  qr: ReceiptQrSymbol | null,
  footer: FooterPlan,
  spec: OrderReceiptSpec,
  measure: ReceiptMeasure,
  label: (ops: ReceiptOp[], meta: ReceiptLabelMeta) => ReceiptLabel,
): ReceiptLabel[] => {
  const r2Bottom = footer.r2Bottom;
  const { banner } = spec;
  const bannerRoom = banner.gap + banner.h;
  // Belgi QR ustuni (yetkazish turi, sana) ga tegmaydi: R1 ichida — R1 enida, aks holda R1 tagidan to'liq enda. A4
  // katagida QR ostida to'liq enli joy yo'q (R2 ~0) — A blok belgini R1 ga sig'diradigan joygacha.
  const fullWidthRoom = r2Bottom - spec.r1.bottom >= bannerRoom - EPS;
  const limit = fullWidthRoom ? r2Bottom - bannerRoom : spec.r1.bottom - bannerRoom;

  // 1/2: A blok — banner bilan sig'adigan birinchi pog'ona; P3 da ham sig'masa — sig'gancha (to'liq manzil 2/2 da).
  let level = spec.levels[spec.levels.length - 1];
  let a: { result: BlockResult; overflow: boolean } | null = null;
  for (const candidate of spec.levels) {
    const attempt = layoutA(model, candidate, spec, measure, limit);
    if (!attempt.overflow) {
      level = candidate;
      a = attempt;
      break;
    }
  }
  let addressCut = false;
  if (!a) {
    a = layoutA(model, level, spec, measure, limit);
    addressCut = true;
    const last = a.result.lines[a.result.lines.length - 1];
    if (last) {
      // Oxirgi sig'gan qator «…» bilan tugaydi: manzil 2/2 da to'liq.
      const tokens = [
        ...last.tokens,
        { text: ELLIPSIS, weight: last.tokens[last.tokens.length - 1].weight },
      ];
      while (tokens.length > 1 && tokensWidth(tokens, last.pt, measure) > last.width + EPS)
        tokens.splice(-2, 1);
      a.result.lines[a.result.lines.length - 1] = { ...last, tokens };
    }
  }

  // Qisqa mahsulot (sig'sa): chiziq + bitta mahsulotlar paragrafi, keyin banner.
  let shortProducts: BlockResult | null = null;
  let shortShown = 0;
  if (!addressCut && model.products.length) {
    for (let shown = model.products.length; shown >= 1 && !shortProducts; shown -= 1) {
      const block = layoutB(
        { ...model, comment: "" },
        level,
        shown,
        "after-a",
        a.result.end,
        limit,
        spec,
        measure,
      );
      if (block) {
        shortProducts = block;
        shortShown = shown;
      }
    }
  }

  const continuation = layoutContinuation(model, r2Bottom, spec, measure);
  const parts = continuation.length + 1;

  const what = [
    ...(addressCut ? ["manzil"] : []),
    ...(model.comment ? ["izoh"] : []),
    ...(model.products.length ? [`${model.products.length} ta mahsulot`] : []),
  ];
  const bannerText = `Davomi 2/${parts} yorliqda${what.length ? `: ${joinUz(what)}` : ""} →`;

  const first: ReceiptOp[] = [];
  const firstFit = fixedOps(
    model,
    { ref: model.ref, amount: model.amount, date: partDate(model.date, 1, parts) },
    qr,
    footer,
    spec,
    measure,
    first,
  );
  first.push(
    ...blockOps(a.result, measure),
    ...(shortProducts ? blockOps(shortProducts, measure) : []),
  );
  const bannerWidth = measure(bannerText, banner.pt, 700);
  const afterA = (shortProducts?.end ?? a.result.end) + banner.gap;
  const inR1 =
    afterA + banner.h <= spec.r1.bottom + EPS && bannerWidth <= spec.r1.w - 2 * banner.radius + EPS;
  const bannerX = inR1 ? spec.r1.x : spec.r2.x;
  const bannerW = inR1 ? spec.r1.w : spec.r2.w;
  const bannerY = inR1 ? afterA : Math.max(afterA, spec.r1.bottom);
  first.push({
    kind: "rect",
    x: bannerX,
    y: round3(bannerY),
    w: bannerW,
    h: banner.h,
    radius: banner.radius,
  });
  first.push({
    kind: "text",
    x: round3(bannerX + (bannerW - bannerWidth) / 2),
    baseline: round3(baselineAtCenter(bannerY + banner.h / 2, banner.pt)),
    pt: banner.pt,
    weight: 700,
    text: bannerText,
    paper: true,
  });

  const labels: ReceiptLabel[] = [
    label(first, {
      orderId: model.id,
      part: 1,
      parts,
      level: level.id,
      numberPt: firstFit.numberPt,
      amountPt: firstFit.amountPt,
      headerGap: firstFit.gap,
      productsShown: shortShown,
      bPlacement: shortProducts ? "after-a" : null,
    }),
  ];
  continuation.forEach((page, index) => {
    const part = index + 2;
    const ops: ReceiptOp[] = [];
    const fit = fixedOps(
      model,
      {
        ref: model.ref,
        amount: { kind: "label", text: `${part}/${parts} · davomi` },
        date: partDate(model.date, part, parts),
      },
      qr,
      footer,
      spec,
      measure,
      ops,
    );
    ops.push(...page.ops);
    labels.push(
      label(ops, {
        orderId: model.id,
        part,
        parts,
        level: "P3",
        numberPt: fit.numberPt,
        amountPt: fit.amountPt,
        headerGap: fit.gap,
        productsShown: page.productsShown,
        bPlacement: null,
      }),
    );
  });
  return labels;
};

/* ───────────────────────────── Sahifalar ───────────────────────────── */

/** Buyurtma cheki varag'i: termal 100×60 (1 chek = 1 sahifa) yoki A4 (12 ta, 2 × 6). */
export type ReceiptSheet = "thermal" | "a4";

/** Varaq → katak o'lchamlari (yorliqlar shu spec bilan joylanadi; T8 kategoriya yorlig'i ham shu o'lchamda). */
export const ORDER_RECEIPT_SPECS: Readonly<Record<ReceiptSheet, OrderReceiptSpec>> = Object.freeze({
  thermal: THERMAL_ORDER_SPEC,
  a4: A4_ORDER_SPEC,
});

/**
 * A4 varaq (maket 03): 210×297 mm, chekka 5 mm, 2 ustun × 6 qator katak 100×47,5 mm (to'r maketdagidek 6,2 mm dan —
 * pastda 5,8 mm), 13-chekdan yangi varaq. Kesish chiziqlari — punktir 0,2 mm (faqat kataklar orasida), boshida qaychi
 * belgisi (vertikal chiziqniki varaq tepasidan 1,6 mm).
 */
export const A4_SHEET = Object.freeze({
  width: 210,
  height: 297,
  x: 5,
  y: 6.2,
  columns: 2,
  rows: 6,
  cell: { width: 100, height: 47.5 },
  // Maket: CSS `1px dashed` (5 px/mm) — bo'lak 0,6, oraliq 0,4 mm; chiziq katak chegarasidan pastda / o'ngda.
  cut: { stroke: 0.2, dash: 0.6, gap: 0.4 },
  scissors: { size: 3.2, inset: 0.8, top: 1.6 },
});

/** Amalni (mm) siljitadi — yorliq katakka qo'yilganda. */
export const translateReceiptOp = (op: ReceiptOp, dx: number, dy: number): ReceiptOp => {
  switch (op.kind) {
    case "text":
      return { ...op, x: round3(op.x + dx), baseline: round3(op.baseline + dy) };
    case "dash":
      return {
        ...op,
        x1: round3(op.x1 + dx),
        y1: round3(op.y1 + dy),
        x2: round3(op.x2 + dx),
        y2: round3(op.y2 + dy),
      };
    default:
      return { ...op, x: round3(op.x + dx), y: round3(op.y + dy) };
  }
};

const a4CutOps = (count: number): ReceiptOp[] => {
  const { x, y, columns, cell, cut, scissors } = A4_SHEET;
  const rows = Math.ceil(count / columns);
  const ops: ReceiptOp[] = [];
  const half = scissors.size / 2;
  const axis = cut.stroke / 2;
  for (let row = 1; row < rows; row += 1) {
    const edge = y + row * cell.height;
    const lineY = round3(edge + axis);
    ops.push({ kind: "dash", x1: x, y1: lineY, x2: x + columns * cell.width, y2: lineY, ...cut });
    ops.push({ kind: "scissors", x: scissors.inset, y: round3(edge - half), size: scissors.size });
  }
  if (count > 1) {
    const edge = x + cell.width;
    const lineX = round3(edge + axis);
    ops.push({
      kind: "dash",
      x1: lineX,
      y1: y,
      x2: lineX,
      y2: round3(y + rows * cell.height),
      ...cut,
    });
    ops.push({
      kind: "scissors",
      x: round3(edge - half),
      y: scissors.top,
      size: scissors.size,
    });
  }
  return ops;
};

/**
 * Yorliqlar → sahifalar. Termal: 1 yorliq = 1 sahifa (100×60). A4: 12 tadan, chapdan o'ngga va yuqoridan pastga
 * (davomi 2/2 — keyingi katakka); kesish chiziqlari faqat to'ldirilgan kataklar orasida.
 */
export const composeReceiptPages = (
  labels: ReceiptLabel[],
  sheet: ReceiptSheet = "thermal",
): ReceiptPage[] => {
  if (sheet === "thermal") return labels.map(({ width, height, ops }) => ({ width, height, ops }));
  if (sheet !== "a4") throw new Error(`Noma'lum varaq: ${String(sheet)}`);
  const perPage = A4_SHEET.columns * A4_SHEET.rows;
  const pages: ReceiptPage[] = [];
  for (let start = 0; start < labels.length; start += perPage) {
    const chunk = labels.slice(start, start + perPage);
    const ops: ReceiptOp[] = a4CutOps(chunk.length);
    chunk.forEach((label, index) => {
      const dx = A4_SHEET.x + (index % A4_SHEET.columns) * A4_SHEET.cell.width;
      const dy = A4_SHEET.y + Math.floor(index / A4_SHEET.columns) * A4_SHEET.cell.height;
      for (const op of label.ops) ops.push(translateReceiptOp(op, dx, dy));
    });
    pages.push({ width: A4_SHEET.width, height: A4_SHEET.height, ops });
  }
  return pages;
};
