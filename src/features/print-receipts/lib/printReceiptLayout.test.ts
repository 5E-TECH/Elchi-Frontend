import { beforeAll, describe, expect, it } from "vitest";
import { createTestReceiptMeasure, loadTestReceiptFonts } from "../../../test/receiptTestFonts";
import { MM_PER_PT, RECEIPT_FONT_METRICS, type ReceiptMeasure } from "./printReceiptFonts";
import {
  A4_ORDER_SPEC,
  A4_SHEET,
  composeReceiptPages,
  fitReceiptHeader,
  layoutOrderReceipt,
  receiptLineHeight,
  type ReceiptFrameOp,
  type ReceiptLabel,
  type ReceiptQrOp,
  type ReceiptRectOp,
  type ReceiptTextOp,
} from "./printReceiptLayout";
import { toReceiptOrderModel, type ReceiptOrderSource } from "./printReceiptModel";
import { LONG_COMMENT, RECEIPT_SAMPLES } from "./receiptSamples";

/**
 * HJ5sLHiz — joylash algoritmi maket `tizim-receipts` (01, 01.B a–f, 1/2 + 2/2) bilan solishtiriladi: koordinatalar
 * maket HTML'idan (1 mm = 5 px), haqiqiy TTF (glif kengligi + GPOS kerning — maket brauzerda kerning bilan chizilgan)
 * bilan. Struktura (zonalar, qatorlar, chiziqlar) ±0,2 mm; ramka eni — ±0,2 mm (maketda butun px ga yaxlitlangan).
 */

let measure: ReceiptMeasure;
beforeAll(async () => {
  measure = createTestReceiptMeasure(await loadTestReceiptFonts());
});

const px = (value: number) => value / 5;
const layout = (source: ReceiptOrderSource) =>
  layoutOrderReceipt(toReceiptOrderModel(source), { measure });

const texts = (label: ReceiptLabel) =>
  label.ops.filter((op): op is ReceiptTextOp => op.kind === "text");
const rects = (label: ReceiptLabel) =>
  label.ops.filter((op): op is ReceiptRectOp => op.kind === "rect");
const frames = (label: ReceiptLabel) =>
  label.ops.filter((op): op is ReceiptFrameOp => op.kind === "frame");
const qrOf = (label: ReceiptLabel) => label.ops.find((op): op is ReceiptQrOp => op.kind === "qr");
const text = (label: ReceiptLabel, value: string) => {
  const op = texts(label).find((item) => item.text === value);
  if (!op)
    throw new Error(
      `«${value}» yo'q: ${texts(label)
        .map((item) => item.text)
        .join(" | ")}`,
    );
  return op;
};
/** Matn qatorining yuqori cheti (CSS qator qutisi, balandligi `lineHeight`) — maketdagi `top`. */
const lineTop = (op: ReceiptTextOp, lineHeight: number) =>
  op.baseline -
  lineHeight / 2 -
  ((RECEIPT_FONT_METRICS.ascent - RECEIPT_FONT_METRICS.descent) / 2) * op.pt * MM_PER_PT;
const top = (op: ReceiptTextOp, factor = 1.2) => lineTop(op, receiptLineHeight(op.pt, factor));
const near = (actual: number, expected: number, tolerance = 0.2) =>
  expect(Math.abs(actual - expected), `${actual} ≈ ${expected} ± ${tolerance}`).toBeLessThanOrEqual(
    tolerance + 1e-9,
  );

/** Matn qatorlari ketma-ket (ko'p bo'lakli qatorlar — bitta qator). */
const lines = (label: ReceiptLabel, pt: number) => {
  const byBaseline = new Map<number, ReceiptTextOp[]>();
  for (const op of texts(label).filter((item) => item.pt === pt && !item.paper)) {
    byBaseline.set(op.baseline, [...(byBaseline.get(op.baseline) ?? []), op]);
  }
  return [...byBaseline.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, ops]) => ({
      top: top(ops[0]),
      x: ops[0].x,
      text: ops
        .map((op) => op.text)
        .join(" ")
        .replace(/\s+/g, " "),
    }));
};

describe("header: № and boxed sum (ega qarori 2)", () => {
  const collect = (value: string) => ({ kind: "collect", value, total: null }) as const;
  const fit = (ref: string, amount: Parameters<typeof fitReceiptHeader>[1]) =>
    fitReceiptHeader(ref, amount, measure);

  it("№ 18 → 16 → 14 → 12, for each the sum 16 → 14 → 12; first pair with ≥ 5 mm gap", () => {
    expect(fit("№10241", collect("185 000"))).toMatchObject({ numberPt: 18, amountPt: 16 });
    expect(fit("№10412", collect("1 250 000"))).toMatchObject({ numberPt: 18, amountPt: 14 });
    // 01.B e: «№104127» + 12 500 000 so'm → № 16, summa 12.
    expect(fit("№104127", collect("12 500 000"))).toMatchObject({ numberPt: 16, amountPt: 12 });
    // TZ 2-savol: to'liq «№EL-…» bilan 185 000 → № 14, summa 14.
    expect(fit("№EL-100081", collect("185 000"))).toMatchObject({ numberPt: 14, amountPt: 14 });
    const big = fit("№EL-100081", collect("12 500 000"));
    expect(big).toMatchObject({ numberPt: 12, amountPt: 12 });
    expect(big.gap!).toBeGreaterThanOrEqual(5);
  });

  it("12 / 12 that still does not fit with 5 mm keeps a 4 mm gap — № and sum are never cut", () => {
    // Haqiqiy shrift (kerning bilan): «№EL-100081» + 999 999 999 → 12 / 12, oraliq 5 mm dan ko'p.
    expect(fit("№EL-100081", collect("999 999 999"))).toMatchObject({
      numberPt: 12,
      amountPt: 12,
    });
    // Algoritm: bir xil enli soxta shrift (0,5 em) — 12 / 12 da 5 mm sig'maydi, 4 mm bilan qoladi.
    const mono: ReceiptMeasure = (value, pt) => Array.from(value).length * 0.5 * pt * MM_PER_PT;
    const result = fitReceiptHeader("№EL-100081", collect("999 999 999 999"), mono);
    expect(result).toMatchObject({ numberPt: 12, amountPt: 12 });
    expect(result.gap!).toBeGreaterThanOrEqual(4);
    expect(result.gap!).toBeLessThan(5);
  });

  it("labels keep 12 pt («To'langan», «2/2 · davomi»); no money field → no box, № alone", () => {
    expect(fit("№10433", { kind: "label", text: "To'langan" })).toMatchObject({
      numberPt: 18,
      amountPt: 12,
    });
    expect(fit("№EL-100081", null)).toMatchObject({ numberPt: 18, amountPt: null, gap: null });
  });
});

describe("order receipt 100×60 — mockup 01", () => {
  it("anatomy: zones, fonts and coordinates of sample №10241", () => {
    const [label, ...rest] = layout(RECEIPT_SAMPLES.main);
    expect(rest).toHaveLength(0);
    expect(label).toMatchObject({ width: 100, height: 60 });
    expect(label.meta).toMatchObject({
      part: 1,
      parts: 1,
      level: "P0",
      numberPt: 18,
      amountPt: 16,
      bPlacement: "r2",
    });

    // 1 — raqam: 18 pt, chap, pastki cheti 11,4 mm.
    const ref = text(label, "№10241");
    expect(ref).toMatchObject({ x: 2, pt: 18, weight: 700 });
    near(top(ref, 1.1), px(22));
    near(top(ref, 1.1) + receiptLineHeight(18, 1.1), 11.4);
    // 2 — summa ramkasi: o'ng cheti 69,4, pastki 11,4; 0,4 mm, burchak 1,2.
    const [box] = frames(label);
    near(box.x + box.w, 69.4);
    near(box.y + box.h, 11.4);
    expect(box).toMatchObject({ h: 8, stroke: 0.4, radius: 1.2 });
    near(box.x, px(186));
    // Summa bazaviy chizig'i maketdagi CSS qator qutisidek (ramka markazidan 0,5 mm yuqori): maket DOM — 9,0 mm.
    expect(text(label, "185 000")).toMatchObject({ pt: 16, weight: 700 });
    near(text(label, "185 000").baseline, 9.02, 0.01);
    expect(text(label, " so'm")).toMatchObject({
      pt: 8,
      baseline: text(label, "185 000").baseline,
    });
    // Sarlavha chizig'i: y 12, 0,4 mm, x 2–69,4.
    expect(rects(label)).toContainEqual({ kind: "rect", x: 2, y: 12, w: 67.4, h: 0.4 });

    // 3–5 — ism, telefon, manzil (R1).
    expect(lines(label, 13)).toEqual([
      { top: expect.any(Number), x: 2, text: "Dilnoza Karimova" },
      { top: expect.any(Number), x: 2, text: "+998 90 123 45 67" },
    ]);
    const [name, phone] = lines(label, 13);
    near(name.top, px(66));
    near(phone.top, px(93));
    near(lines(label, 10)[0].top, px(124));
    expect(lines(label, 10)[0].text).toBe("Samarqand · Urgut tumani");
    const street = lines(label, 9);
    expect(street.map((line) => line.text)).toEqual([
      "Navoiy ko'chasi 14-uy, 3-xonadon, Urgut",
      "bozori yonida",
    ]);
    near(street[0].top, px(145));
    near(street[1].top, px(164));
    // Kerning bilan qator eni maketdagidek (maket DOM: o'ng chet 61,51 mm; maket shrifti 0,1 px ga yaxlitlangan).
    near(2 + measure(street[0].text, 9, 500), 61.51, 0.1);

    // 9 — B blok R2 boshidan: chiziq y 41,2 (to'liq en), mahsulot va izoh 8,5 pt.
    expect(rects(label)).toContainEqual({ kind: "rect", x: 2, y: 41.2, w: 96, h: 0.25 });
    const body = lines(label, 8.5);
    expect(body.map((line) => line.text)).toEqual([
      "Smart soat X8 Pro ×1, Quvvatlagich 20W ×2",
      "Izoh: Soat 18:00 dan keyin qo'ng'iroq qiling",
    ]);
    near(body[0].top, px(210));
    near(body[1].top, px(228));
    expect(text(label, "Izoh:").weight).toBe(700);
    expect(text(label, "Soat 18:00 dan keyin qo'ng'iroq qiling").weight).toBe(500);

    // 6 — QR: x 74, y 4, V3, modul 0,75 → 21,75 mm.
    expect(qrOf(label)).toMatchObject({
      x: 74,
      y: 4,
      module: 0.75,
      symbol: { version: 3, count: 29 },
    });
    // 7 — yetkazish turi: qora 25,6 × 6 mm, burchak 1,2; oq 8,5 pt bosh harflar.
    expect(rects(label)).toContainEqual({
      kind: "rect",
      x: 72.2,
      y: 29.6,
      w: 25.6,
      h: 6,
      radius: 1.2,
    });
    const badge = text(label, "UYGACHA");
    expect(badge).toMatchObject({ pt: 8.5, weight: 700, paper: true });
    // 8 — sana: 8 pt, y 36,6, ustun markazida.
    const date = text(label, "23.10.2026");
    expect(date).toMatchObject({ pt: 8, weight: 700 });
    near(lineTop(date, 3.6), 36.6); // maketda sana qatori 18 px (3,6 mm)
    near(date.x + measure("23.10.2026", 8, 700) / 2, 85, 0.05);

    // 10 — pastki band: chiziq y 53,6; «Jo'natuvchi:» 500 + nom 700, o'ngda «Muammo bo'lsa:» 500 + telefon 700.
    expect(rects(label)).toContainEqual({ kind: "rect", x: 2, y: 53.6, w: 96, h: 0.25 });
    expect(text(label, "Jo'natuvchi:")).toMatchObject({ x: 2, pt: 8, weight: 500 });
    expect(text(label, "Baraka Shop").weight).toBe(700);
    expect(text(label, "Muammo bo'lsa:").weight).toBe(500);
    const contact = text(label, "+998 71 200 11 22");
    near(contact.x + measure(contact.text, 8, 700), 98, 0.01);
    near(contact.baseline, text(label, "Baraka Shop").baseline, 0);
  });

  it("partly paid, to the centre: «jami» under the sum, box 9,6 mm; no street / comment lines", () => {
    const [label] = layout(RECEIPT_SAMPLES.partial);
    const [box] = frames(label);
    expect(box.h).toBe(9.6);
    near(box.y, px(9));
    expect(text(label, "120 000").pt).toBe(16);
    expect(text(label, "jami 250 000")).toMatchObject({ pt: 7, weight: 600 });
    // Maket DOM: summa 6,8 mm, «jami» 10,8 mm (1 px = 0,2 mm to'rida).
    near(text(label, "120 000").baseline, 6.8);
    near(text(label, "jami 250 000").baseline, 10.8, 0.1);
    expect(text(label, "MARKAZGACHA").paper).toBe(true);
    expect(text(label, "22.10.2026")).toBeTruthy();
    expect(lines(label, 9)).toEqual([]);
    expect(texts(label).some((op) => op.text.startsWith("Izoh"))).toBe(false);
  });

  it("long name, two phones, 6 products: name 11 pt + «…» (first word kept), sum 14 pt, products shortened first", () => {
    const [label] = layout(RECEIPT_SAMPLES.longName);
    // Mahsulotlar qisqardi → B blok A dan keyin darhol (maket 04: «R2 boshidan — hammasi sig'sa»): chiziq 41,0 mm.
    expect(label.meta).toMatchObject({
      level: "P0",
      amountPt: 14,
      productsShown: 2,
      bPlacement: "after-a",
    });
    expect(rects(label)).toContainEqual({ kind: "rect", x: 2, y: 41, w: 96, h: 0.25 });
    near(text(label, "1 250 000").baseline, 9.2);
    const name = text(label, "Abdurahmonova Mohinur…");
    expect(name.pt).toBe(11);
    near(top(name), px(66));
    near(top(text(label, "+998 97 342 88 06")), px(89));
    const extra = text(label, "+998 99 198 19 29");
    expect(extra.pt).toBe(11);
    near(top(extra), px(116));
    near(lines(label, 10)[0].top, px(143));
    expect(lines(label, 9).map((line) => line.text)).toEqual([
      "Mahtumquli ko'chasi 112-uy, 4-podyezd,",
      "9-qavat, 36-xonadon, domofon ishlamaydi",
    ]);
    const body = lines(label, 8.5);
    expect(body.map((line) => line.text)).toEqual([
      "Kir yuvish mashinasi 7 kg ×1, Changyutgich ×1 … +4 ta mahsulot",
      "Izoh: Avval qo'ng'iroq qiling, uyda faqat kechqurun bo'lamiz, eshik",
      "kodi 4512",
    ]);
    near(body[0].top, px(209), 0.01);
    near(body[2].top, px(245), 0.01);
    const [box] = frames(label);
    expect(box.h).toBe(7.4);
    near(box.x, px(179));
  });

  it("fully paid → «To'langan» 12 pt in the box", () => {
    const [label] = layout(RECEIPT_SAMPLES.paid);
    expect(text(label, "To'langan").pt).toBe(12);
    const [box] = frames(label);
    expect(box.h).toBe(6.8);
    near(box.x + box.w, 69.4);
    near(box.x, px(232));
  });
});

describe("edge cases — mockup 01.B a–f", () => {
  it("a) extra phone 11 pt under the main one; nothing shrinks", () => {
    const [label] = layout(RECEIPT_SAMPLES.a);
    expect(label.meta).toMatchObject({ level: "P0", bPlacement: "r2" });
    near(top(text(label, "+998 99 198 19 29")), px(120));
    near(lines(label, 10)[0].top, px(147));
    near(lines(label, 9)[0].top, px(168));
    expect(lines(label, 8.5).map((line) => line.text)).toEqual([
      "Elektr choynak ×2",
      "Izoh: Ikkinchi raqam — turmush o'rtog'i",
    ]);
  });

  it("b) 9 products fit two full-width lines under the QR — not shortened", () => {
    const [label] = layout(RECEIPT_SAMPLES.b);
    expect(label.meta).toMatchObject({ level: "P0", productsShown: 9 });
    const body = lines(label, 8.5);
    expect(body.map((line) => line.text)).toEqual([
      "Choynak to'plami ×1, Piyola ×6, Lagan ×2, Dazmol ×1, Blender ×1,",
      "Choy qoshiq to'plami ×1, Sochiq ×4, Dasturxon ×1, Termos 1 l ×1",
    ]);
    near(body[0].top, px(210));
    near(body[1].top, px(228));
  });

  it("c) long address with landmark: 3 lines next to the QR column, the 4th at full width; B right after A", () => {
    const [label] = layout(RECEIPT_SAMPLES.c);
    expect(label.meta).toMatchObject({ level: "P0", bPlacement: "after-a" });
    const street = lines(label, 9);
    expect(street.map((line) => line.text)).toEqual([
      "Mahtumquli ko'chasi 112-uy, 4-podyezd,",
      "9-qavat, 36-xonadon. Mo'ljal: Yashnobod",
      "dehqon bozori ro'parasi, bank filiali yonidagi",
      "oq bino",
    ]);
    [145, 164, 183, 204].forEach((value, index) => near(street[index].top, px(value)));
    expect(rects(label)).toContainEqual({ kind: "rect", x: 2, y: 45.2, w: 96, h: 0.25 });
    near(lines(label, 8.5)[0].top, px(230));
  });

  it("d) ~210-character comment: P1 (7,5 pt), B lifted next to the QR column, not a letter cut", () => {
    expect(LONG_COMMENT.length).toBeGreaterThanOrEqual(200); // maketdagi matn (205 belgi, «210 belgi» namunasi)
    const [label, ...rest] = layout(RECEIPT_SAMPLES.d);
    expect(rest).toHaveLength(0);
    expect(label.meta).toMatchObject({ level: "P1", bPlacement: "after-a" });
    expect(rects(label)).toContainEqual({ kind: "rect", x: 2, y: 33.4, w: 67.4, h: 0.25 });
    const body = lines(label, 7.5);
    expect(body.map((line) => line.text)).toEqual([
      "Bolalar kiyimi to'plami ×2",
      "Izoh: Iltimos, avval qo'ng'iroq qiling: uyda faqat soat",
      "18:00 dan keyin bo'lamiz. Domofon ishlamaydi, 4-podyezd oldida kuting yoki",
      "qo'shniga (36-xonadon) qoldiring. Pulni naqd beramiz, qaytimni tayyorlab",
      "keling.",
    ]);
    [171, 187, 204, 220, 236].forEach((value, index) => near(body[index].top, px(value)));
    expect(
      body
        .slice(1)
        .map((line) => line.text)
        .join(" "),
    ).toBe(`Izoh: ${LONG_COMMENT}`);
  });

  it("e) everything together → 1/2 + 2/2 with the same QR; address, comment and phones never cut", () => {
    const labels = layout(RECEIPT_SAMPLES.e);
    expect(labels).toHaveLength(2);
    const [first, second] = labels;
    expect(first.meta).toMatchObject({
      part: 1,
      parts: 2,
      level: "P0",
      numberPt: 16,
      amountPt: 12,
      productsShown: 0,
    });
    expect(first.meta!.headerGap!).toBeGreaterThanOrEqual(5);
    near(top(text(first, "№104127"), 1.1), px(26));
    expect(text(first, "12 500 000").pt).toBe(12);
    near(frames(first)[0].x, px(182), 0.5);
    expect(text(first, "1/2 · 23.10.2026")).toBeTruthy();
    expect(lines(first, 9).map((line) => line.text)).toEqual([
      "Mahtumquli ko'chasi 112-uy, 4-podyezd,",
      "9-qavat, 36-xonadon. Mo'ljal: Yashnobod",
      "dehqon bozori ro'parasi, bank filiali yonidagi oq bino",
    ]);
    // Qora belgi: A dan 0,8 mm pastda, 96 × 3,6 mm, 8 pt oq.
    expect(rects(first)).toContainEqual({
      kind: "rect",
      x: 2,
      y: px(227),
      w: 96,
      h: 3.6,
      radius: 1.2,
    });
    expect(text(first, "Davomi 2/2 yorliqda: izoh va 9 ta mahsulot →")).toMatchObject({
      pt: 8,
      paper: true,
    });
    expect(texts(first).some((op) => op.text.startsWith("Izoh"))).toBe(false);

    expect(second.meta).toMatchObject({
      part: 2,
      parts: 2,
      numberPt: 18,
      amountPt: 12,
      productsShown: 6,
    });
    expect(text(second, "2/2 · davomi").pt).toBe(12);
    expect(text(second, "2/2 · 23.10.2026")).toBeTruthy();
    const body = lines(second, 7.5);
    expect(body.map((line) => line.text)).toEqual([
      "Manzil: Toshkent sh. · Yashnobod tumani,",
      "Mahtumquli ko'chasi 112-uy, 4-podyezd, 9-qavat,",
      "36-xonadon. Mo'ljal: Yashnobod dehqon bozori",
      "ro'parasi, bank filiali yonidagi oq bino",
      "Izoh: Iltimos, avval qo'ng'iroq qiling: uyda faqat soat",
      "18:00 dan keyin bo'lamiz. Domofon ishlamaydi,",
      "4-podyezd oldida kuting yoki qo'shniga (36-xonadon)",
      "qoldiring. Pulni naqd beramiz, qaytimni tayyorlab",
      "keling.",
      "Mahsulotlar (9 ta): Kir yuvish mashinasi 7 kg ×1, Changyutgich ×1, Elektr",
      "choynak ×2, Dazmol ×1, Blender ×1, Tarozi ×1 … +3 ta — to'liq ro'yxat ilovada",
    ]);
    [66, 82, 98, 114, 134, 150, 166, 182, 204, 224, 240].forEach((value, index) =>
      near(body[index].top, px(value)),
    );
    expect(qrOf(second)!.symbol).toEqual(qrOf(first)!.symbol);
    expect(text(second, "UYGACHA")).toBeTruthy();
  });

  it("f) short: one product, no comment — free space stays, fonts do not grow", () => {
    const [label] = layout(RECEIPT_SAMPLES.f);
    expect(label.meta).toMatchObject({ level: "P0", numberPt: 18, amountPt: 16 });
    expect(lines(label, 8.5).map((line) => line.text)).toEqual(["Telefon g'ilofi ×2"]);
    near(frames(label)[0].x, px(202), 0.5);
  });
});

describe("text is never cut (acceptance 6)", () => {
  const allText = (labels: ReceiptLabel[]) =>
    labels
      .flatMap((label) => texts(label).map((op) => op.text))
      .join(" ")
      .replace(/\s+/g, " ");

  it("4-line address + 210-character comment + 9 products: all words of address and comment are printed", () => {
    const labels = layout(RECEIPT_SAMPLES.e);
    const printed = allText(labels);
    for (const word of `${RECEIPT_SAMPLES.e.address} ${LONG_COMMENT}`.split(" "))
      expect(printed).toContain(word);
    expect(printed).toContain("+998 97 342 88 06");
    expect(printed).toContain("+998 99 198 19 29");
  });

  it("an address too long for 1/2 continues on 2/2 (and 3/3) — never truncated", () => {
    const address = Array.from(
      { length: 14 },
      (_, i) => `${i + 1}-mo'ljal: katta ko'cha, uzun bino oldida`,
    ).join(", ");
    const labels = layout({ ...RECEIPT_SAMPLES.e, address });
    expect(labels.length).toBeGreaterThanOrEqual(3);
    expect(labels.every((label) => label.meta!.parts === labels.length)).toBe(true);
    const continuation = allText(labels.slice(1));
    for (const word of address.split(" ")) expect(continuation).toContain(word);
    expect(texts(labels[0]).some((op) => op.text.includes("manzil, izoh va 9 ta mahsulot"))).toBe(
      true,
    );
  });

  it("every op stays on the 100×60 label inside the 2 mm safe margin", () => {
    for (const source of Object.values(RECEIPT_SAMPLES)) {
      for (const label of layout(source)) {
        for (const op of label.ops) {
          if (op.kind === "text") {
            expect(op.x).toBeGreaterThanOrEqual(2 - 1e-9);
            expect(op.x + measure(op.text, op.pt, op.weight)).toBeLessThanOrEqual(98 + 0.05);
            expect(op.baseline).toBeLessThanOrEqual(58);
          } else if (op.kind === "rect" || op.kind === "frame") {
            expect(op.x).toBeGreaterThanOrEqual(2 - 1e-9);
            expect(op.x + op.w).toBeLessThanOrEqual(98 + 1e-9);
            expect(op.y + op.h).toBeLessThanOrEqual(58 + 1e-9);
          }
        }
      }
    }
  });
});

describe("empty fields, QR, contacts", () => {
  it("empty fields are not rendered: no «-», «—», «undefined», no B rule, no footer", () => {
    const [label] = layout({
      id: "7",
      qr_code_token: "0123456789abcdef01234567",
      comment: "-",
      address: "—",
    });
    const values = texts(label).map((op) => op.text);
    expect(values).toEqual(["№7", "UYGACHA"]);
    for (const value of values) expect(value).not.toMatch(/^[-—]$|undefined|null/);
    // Faqat sarlavha chizig'i va qora yorliq — B va pastki band chizig'i yo'q.
    expect(rects(label).map((rect) => rect.y)).toEqual([12, 29.6]);
    expect(frames(label)).toEqual([]);
  });

  it("no QR token → 21,75 mm frame with «QR yo'q» (the id is not encoded)", () => {
    const [label] = layout({ ...RECEIPT_SAMPLES.f, qr_code_token: null });
    expect(qrOf(label)).toBeUndefined();
    expect(frames(label)).toContainEqual({
      kind: "frame",
      x: 74,
      y: 4,
      w: 21.75,
      h: 21.75,
      radius: 0,
      stroke: 0.25,
    });
    expect(text(label, "QR yo'q").pt).toBe(8);
  });

  it("CANCEL-… token (V4) uses 5-dot modules centred in the QR box", () => {
    const [label] = layout({ ...RECEIPT_SAMPLES.f, qr_code_token: "CANCEL-0123456789abcdef0123" });
    const qr = qrOf(label)!;
    expect(qr.symbol.count).toBe(33);
    near(qr.module, 0.625, 1e-6);
    near(qr.x, 74 + (21.75 - 33 * 0.625) / 2, 1e-3);
  });

  it("two «Muammo bo'lsa» numbers stay whole; the sender is shortened and the band wraps to two lines (ega qarori 4)", () => {
    const [label] = layout({
      ...RECEIPT_SAMPLES.main,
      operator_phone: "+998901234567",
      secondary_operator_phone: "+998991981929",
      market: {
        name: "Juda uzun nomli market — Toshkent shahar Chilonzor filiali ombori",
        phone_number: null,
      },
    });
    const contact = text(label, "+998 90 123 45 67, +998 99 198 19 29");
    near(contact.x + measure(contact.text, 8, 700), 98, 0.01);
    const sender = texts(label).find((op) => op.weight === 700 && op.text.startsWith("Juda uzun"))!;
    expect(sender.text.endsWith("…")).toBe(true);
    expect(sender.baseline).toBeLessThan(contact.baseline);
    expect(rects(label)).toContainEqual({ kind: "rect", x: 2, y: 50, w: 96, h: 0.25 });
    // R2 qisqardi: mahsulot va izoh bandga tegmaydi.
    for (const op of texts(label).filter((item) => item.pt === 8.5))
      expect(op.baseline).toBeLessThan(50);
  });

  it("Cyrillic name and address are laid out as entered (Noto glyphs measured)", () => {
    const [label] = layout({
      ...RECEIPT_SAMPLES.f,
      customer: { ...RECEIPT_SAMPLES.f.customer, name: "Қўчқорова Ғулом Ҳасанович" },
      address: "Тошкент шаҳри, Қатортол кўчаси 5-уй",
    });
    expect(text(label, "Қўчқорова Ғулом Ҳасанович").pt).toBe(13);
    expect(lines(label, 9).map((line) => line.text)).toEqual([
      "Тошкент шаҳри, Қатортол кўчаси 5-уй",
    ]);
  });
});

describe("pages", () => {
  it("thermal: one label per 100×60 page, in order (T8 labels can be inserted after an order)", () => {
    const labels = [...layout(RECEIPT_SAMPLES.e), ...layout(RECEIPT_SAMPLES.f)];
    const pages = composeReceiptPages(labels);
    expect(pages).toHaveLength(3);
    expect(pages.map((page) => [page.width, page.height])).toEqual([
      [100, 60],
      [100, 60],
      [100, 60],
    ]);
    expect(pages[2].ops).toBe(labels[2].ops);
  });
});

describe("A4 sheet — mockup 03 (cell 100×47,5 mm, 12 per page)", () => {
  const a4 = (source: ReceiptOrderSource) =>
    layoutOrderReceipt(toReceiptOrderModel(source), { measure }, A4_ORDER_SPEC);

  it("cell anatomy of №10241: № 16 pt, sum 14 pt, P2 (8 / 7,5 → 7 pt), QR 20 mm, badge, date, footer", () => {
    const [label] = a4(RECEIPT_SAMPLES.main);
    expect([label.width, label.height]).toEqual([100, 47.5]);
    // Maketda birinchi chek 8 / 7,5 pt ga tushgan («birinchi chekda 8 / 7,5 pt ga tushgan»).
    expect(label.meta).toMatchObject({
      parts: 1,
      level: "P2",
      numberPt: 16,
      amountPt: 14,
      bPlacement: "after-a",
    });
    const number = text(label, "№10241");
    near(number.x, px(15));
    near(top(number, 1.1), px(23));
    const [box] = frames(label).filter((frame) => frame.stroke === 0.4);
    near(box.x + box.w, px(362));
    near(box.y, px(17));
    near(box.h, px(37));
    // Maketdagi ramka (140 px) mazmunidan tor — summa ichki chekkaga kirib ketgan; bizda chekka to'liq (≤ 0,4 mm farq).
    near(box.x, px(222), 0.4);
    near(text(label, "185 000").baseline, 14.7 - 6.2, 0.05); // maket DOM (varaqda), katakka nisbatan
    expect(rects(label)).toContainEqual({ kind: "rect", x: 3, y: 11.4, w: 69.4, h: 0.4 });
    expect(text(label, "Dilnoza Karimova").pt).toBe(10);
    near(top(text(label, "Dilnoza Karimova")), px(62));
    near(top(text(label, "+998 90 123 45 67")), px(83));
    near(top(text(label, "Samarqand · Urgut tumani")), px(108));
    expect(text(label, "Samarqand · Urgut tumani").pt).toBe(8);
    const street = text(label, "Navoiy ko'chasi 14-uy, 3-xonadon, Urgut bozori yonida");
    expect(street.pt).toBe(7.5);
    near(top(street), px(125));
    // B blok A dan keyin darhol: chiziq 28,8 mm (1 px), mahsulot va izoh 7 pt.
    expect(rects(label)).toContainEqual({ kind: "rect", x: 3, y: 28.8, w: 69.4, h: 0.2 });
    const products = text(label, "Smart soat X8 Pro ×1, Quvvatlagich 20W ×2");
    expect(products.pt).toBe(7);
    near(top(products), px(148));
    near(top(text(label, "Izoh:")), px(163));
    const qr = qrOf(label)!;
    near(qr.x, px(382));
    near(qr.y, px(17));
    near(qr.module * qr.symbol.count, 20, 0.01);
    expect(rects(label)).toContainEqual({
      kind: "rect",
      x: 75.2,
      y: 27.2,
      w: 22.4,
      h: 5,
      radius: 1.2,
    });
    expect(text(label, "UYGACHA")).toMatchObject({ pt: 7, paper: true });
    const date = text(label, "23.10.2026");
    expect(date.pt).toBe(7.5);
    near(top(date), px(165));
    expect(rects(label)).toContainEqual({ kind: "rect", x: 3, y: 39.2, w: 94, h: 0.2 });
    const sender = text(label, "Jo'natuvchi:");
    expect(sender.pt).toBe(7);
    near(lineTop(sender, 3.2), px(204));
  });

  it("partly paid: box 9 mm with «jami» 7 pt; fully paid: «To'langan» 10 pt in a 6 mm box", () => {
    const [partial] = a4(RECEIPT_SAMPLES.partial);
    const [box] = frames(partial).filter((frame) => frame.stroke === 0.4);
    near(box.y, px(9));
    near(box.h, px(45));
    expect(text(partial, "jami 250 000").pt).toBe(7);
    const [paid] = a4(RECEIPT_SAMPLES.paid);
    const [paidBox] = frames(paid).filter((frame) => frame.stroke === 0.4);
    expect(text(paid, "To'langan").pt).toBe(10);
    near(paidBox.y, px(24));
    near(paidBox.h, px(30));
    near(paidBox.x + paidBox.w, px(362));
    // P0: viloyat 9 pt, ko'cha 8 pt, mahsulot 7,5 pt (maket №10243).
    expect(paid.meta?.level).toBe("P0");
    near(top(text(paid, "Qatortol ko'chasi 5-uy")), px(127));
    near(top(text(paid, "Kitob to'plami ×1")), px(151));
  });

  it("«№EL-100081» + 999 999 999: № 14, sum 10, gap ≥ 4 mm — nothing overlaps", () => {
    const fit = fitReceiptHeader(
      "№EL-100081",
      { kind: "collect", value: "999 999 999", total: null },
      measure,
      A4_ORDER_SPEC,
    );
    expect(fit).toMatchObject({ numberPt: 14, amountPt: 10 });
    expect(fit.gap!).toBeGreaterThanOrEqual(4);
  });

  it("too much for one cell → 1/2 + 2/2 in the next cell; the banner stays in the text column; text ≥ 7 pt", () => {
    const labels = a4(RECEIPT_SAMPLES.e);
    expect(labels.length).toBeGreaterThanOrEqual(2);
    for (const label of labels) {
      for (const op of texts(label)) expect(op.pt).toBeGreaterThanOrEqual(7);
    }
    const banner = rects(labels[0]).find((rect) => rect.h === 3.2)!;
    expect(banner.w).toBe(69.4);
    expect(banner.y + banner.h).toBeLessThanOrEqual(36.8 + 1e-6);
    const continuation = labels
      .slice(1)
      .flatMap(texts)
      .map((op) => op.text)
      .join(" ");
    for (const word of LONG_COMMENT.split(" ")) expect(continuation).toContain(word);
  });

  it("12 per A4 page: cells 2 × 6 from (5; 6,2), cut lines between cells, the 13th starts a new sheet", () => {
    const labels = Array.from(
      { length: 13 },
      (_, index) => a4({ ...RECEIPT_SAMPLES.f, id: String(500 + index) })[0],
    );
    const pages = composeReceiptPages(labels, "a4");
    expect(pages.map((page) => [page.width, page.height])).toEqual([
      [210, 297],
      [210, 297],
    ]);
    const dashes = (index: number) => pages[index].ops.filter((op) => op.kind === "dash");
    // 5 gorizontal + 1 vertikal; ikkinchi varaqda bitta chek — chiziq yo'q.
    expect(dashes(0)).toHaveLength(6);
    expect(dashes(1)).toHaveLength(0);
    // Maket: `1px dashed` — bo'lak 0,6, oraliq 0,4 mm; chiziq katak chegarasidan pastda (y 53,7–53,9), o'ngda (x 105–105,2).
    expect(dashes(0)[0]).toMatchObject({
      x1: 5,
      y1: 53.8,
      x2: 205,
      stroke: 0.2,
      dash: 0.6,
      gap: 0.4,
    });
    expect(dashes(0)[5]).toMatchObject({ x1: 105.1, y1: 6.2, x2: 105.1, y2: 291.2 });
    expect(pages[0].ops.filter((op) => op.kind === "scissors")).toHaveLength(6);
    const numbers = pages[0].ops.filter(
      (op): op is ReceiptTextOp => op.kind === "text" && op.text.startsWith("№"),
    );
    expect(numbers.map((op) => [op.text, op.x])).toEqual(
      Array.from({ length: 12 }, (_, index) => [`№${500 + index}`, index % 2 ? 108 : 8]),
    );
    const firstNumber = texts(labels[0]).find((op) => op.text === "№500")!;
    near(numbers[2].baseline - firstNumber.baseline, A4_SHEET.y + A4_SHEET.cell.height, 0.001);
  });
});
