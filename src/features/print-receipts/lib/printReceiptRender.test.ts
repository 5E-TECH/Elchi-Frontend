import { jsPDF } from "jspdf";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestReceiptMeasure, loadTestReceiptFonts } from "../../../test/receiptTestFonts";
import {
  RECEIPT_FACES,
  registerReceiptFonts,
  type ReceiptFontData,
  type ReceiptMeasure,
} from "./printReceiptFonts";
import { renderReceiptHtml } from "./printReceiptHtml";
import {
  composeReceiptPages,
  layoutOrderReceipt,
  splitReceiptKerned,
  type ReceiptPage,
  type ReceiptTextOp,
} from "./printReceiptLayout";
import { toReceiptOrderModel, type ReceiptOrderSource } from "./printReceiptModel";
import { renderReceiptPdf } from "./printReceiptPdf";
import { RECEIPT_SAMPLES } from "./receiptSamples";

/** HJ5sLHiz — PDF va brauzer bitta `ReceiptPage[]` dan (TZ F9, qabul mezonlari 1, 5, 7). */

let fonts: ReceiptFontData;
let measure: ReceiptMeasure;
beforeAll(async () => {
  fonts = await loadTestReceiptFonts();
  measure = createTestReceiptMeasure(fonts);
});

const pagesOf = (...sources: ReceiptOrderSource[]): ReceiptPage[] =>
  composeReceiptPages(
    sources.flatMap((source) => layoutOrderReceipt(toReceiptOrderModel(source), { measure })),
  );

const cyrillic: ReceiptOrderSource = {
  ...RECEIPT_SAMPLES.f,
  id: "10501",
  customer: { ...RECEIPT_SAMPLES.f.customer, name: "Қўчқорова Ғулом Ҳасанович" },
  address: "Тошкент шаҳри, Қатортол кўчаси 5-уй",
};

const renderPdf = async (pages: ReceiptPage[]) => {
  const pdf = new jsPDF({
    unit: "mm",
    format: [100, 60],
    orientation: "landscape",
    compress: false,
  });
  registerReceiptFonts(pdf, fonts);
  await renderReceiptPdf(pdf, pages);
  return pdf;
};

describe("PDF renderer", () => {
  it("one PDF page per label, 100×60 mm landscape", async () => {
    const pages = pagesOf(RECEIPT_SAMPLES.main, RECEIPT_SAMPLES.e);
    const pdf = await renderPdf(pages);
    expect(pdf.getNumberOfPages()).toBe(3);
    expect(pdf.internal.pageSize.getWidth()).toBeCloseTo(100, 3);
    expect(pdf.internal.pageSize.getHeight()).toBeCloseTo(60, 3);
  });

  it("black and white only: every colour operator is 0 or 1", async () => {
    const pdf = await renderPdf(
      pagesOf(RECEIPT_SAMPLES.main, RECEIPT_SAMPLES.partial, RECEIPT_SAMPLES.e),
    );
    const output = pdf.output();
    const colours = [...output.matchAll(/^((?:[\d.]+ )+)(rg|RG|g|G|k|K)$/gm)];
    expect(colours.length).toBeGreaterThan(0);
    for (const [, values, operator] of colours) {
      for (const value of values.trim().split(" "))
        expect([0, 1], `${values}${operator}`).toContain(Number(value));
    }
  });

  it("embeds Manrope and draws қ ғ ҳ with the Noto Sans subset (Cyrillic in PDF)", async () => {
    const pdf = await renderPdf(pagesOf(cyrillic));
    const output = pdf.output();
    expect(output).toContain("/BaseFont /ElchiManrope700");
    expect(output).toContain("/BaseFont /ElchiNoto700");
    const notoId = (
      pdf.internal as unknown as { getFont: (name: string, style: string) => { id: string } }
    ).getFont(RECEIPT_FACES["noto-700"].pdfName, "normal").id;
    expect(output).toMatch(new RegExp(`/${notoId} [\\d.]+ Tf`));
    // ToUnicode: Қ (U+049A) va қ (U+049B) matn sifatida qidiriladi / nusxalanadi.
    expect(output).toMatch(/<049[aA]>/);
    expect(output).toMatch(/<049[bB]>/);
  });
});

describe("HTML renderer", () => {
  const html = (pages: ReceiptPage[]) =>
    renderReceiptHtml(pages, { resolveUrl: (url) => `https://elchi.test${url}` });

  it("one absolutely positioned 100×60 mm page per label, no script", () => {
    const doc = new DOMParser().parseFromString(
      html(pagesOf(RECEIPT_SAMPLES.main, RECEIPT_SAMPLES.e)),
      "text/html",
    );
    expect(doc.querySelectorAll("script")).toHaveLength(0);
    const pages = doc.querySelectorAll(".p");
    expect(pages).toHaveLength(3);
    expect((pages[0] as HTMLElement).style.width).toBe("100mm");
    expect((pages[0] as HTMLElement).style.height).toBe("60mm");
    expect(doc.querySelector("style")?.textContent).toContain("@page{size:100mm 60mm;margin:0}");
  });

  it("same text, positions in mm; lines, frames and QR in one page-size SVG (mm), QR crispEdges", () => {
    const pages = pagesOf(RECEIPT_SAMPLES.main);
    const doc = new DOMParser().parseFromString(html(pages), "text/html");
    const spans = [...doc.querySelectorAll(".p > .t")];
    expect(spans.map((span) => span.textContent)).toEqual(
      pages[0].ops.flatMap((op) => (op.kind === "text" ? [op.text] : [])),
    );
    const ref = spans.find((span) => span.textContent === "№10241") as HTMLElement;
    expect(ref.style.left).toBe("2mm");
    expect(ref.style.fontSize).toBe("18pt");
    expect(ref.style.fontWeight).toBe("700");
    expect(doc.querySelector(".t.w")?.textContent).toBe("UYGACHA");
    // Element qutilari chop etishda butun px ga suriladi — vektor amallar sahifa SVG sida, birlik mm.
    const svg = doc.querySelector(".p > svg.v") as SVGElement;
    expect(svg.getAttribute("viewBox")).toBe("0 0 100 60");
    expect(svg.style.width).toBe("100mm");
    const qr = svg.querySelector("path.qr")!;
    expect(qr.getAttribute("shape-rendering")).toBe("crispEdges");
    expect(qr.getAttribute("transform")).toBe("translate(74 4) scale(0.75)");
    expect(svg.querySelector('rect[x="2"][y="12"][width="67.4"][height="0.4"]')).not.toBeNull();
    const frame = svg.querySelector('rect[fill="none"]')!;
    expect(frame.getAttribute("stroke-width")).toBe("0.4");
    expect(frame.getAttribute("rx")).toBe("1"); // tashqi burchak 1,2 − chiziq yarmi
  });

  it("kerning: PDF and HTML split the text at the same pairs (layout measured it)", async () => {
    const pages = pagesOf(RECEIPT_SAMPLES.main);
    const name = pages[0].ops.find(
      (op): op is ReceiptTextOp => op.kind === "text" && op.text === "Dilnoza Karimova",
    )!;
    // «oz», «za», «ov», «va» — Manrope GPOS kern juftliklari.
    expect(name.kern?.length).toBeGreaterThan(0);
    const parts = splitReceiptKerned(name);
    expect(parts.map(([part]) => part).join("")).toBe(name.text);
    const doc = new DOMParser().parseFromString(html(pages), "text/html");
    const span = [...doc.querySelectorAll(".p > .t")].find(
      (item) => item.textContent === name.text,
    )!;
    const margins = [...span.querySelectorAll("span")].map(
      (item) => (item as HTMLElement).style.marginRight,
    );
    expect(margins).toEqual(
      parts.slice(0, -1).map(([, offset]) => `${Math.round(offset * 1000) / 1000}mm`),
    );
    // PDF: har bo'lak o'z `x` ida alohida `Tj` (jsPDF kerning qo'llamaydi) — `Tj` soni = barcha bo'laklar soni.
    const segments = pages[0].ops.reduce(
      (sum, op) => sum + (op.kind === "text" ? splitReceiptKerned(op).length : 0),
      0,
    );
    expect(segments).toBeGreaterThan(pages[0].ops.filter((op) => op.kind === "text").length);
    expect((await renderPdf(pages)).output().match(/ Tj\n/g)).toHaveLength(segments);
  });

  it("self-hosted fonts with fixed metrics, browser kerning / ligatures off; Noto only for U+0490–04FF", () => {
    const css = new DOMParser()
      .parseFromString(html(pagesOf(cyrillic)), "text/html")
      .querySelector("style")!.textContent!;
    expect(css.match(/@font-face/g)).toHaveLength(5);
    expect(css).toContain('src:url("https://elchi.test/');
    expect(css).toContain("unicode-range:U+0490-04FF");
    expect(css).toContain("ascent-override:106.6%;descent-override:30.0%");
    expect(css).toContain("font-kerning:none;font-variant-ligatures:none");
    // Faqat o'z shriftlari — tashqi manba (Google Fonts, QR xizmati) yo'q.
    const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map(([, url]) => url);
    expect(urls).toHaveLength(5);
    for (const url of urls) expect(url.startsWith("https://elchi.test/")).toBe(true);
  });

  it("ink and paper only (black / white), user text escaped", () => {
    const source = {
      ...RECEIPT_SAMPLES.f,
      customer: { ...RECEIPT_SAMPLES.f.customer, name: "Ali <b>Valiyev</b> & Co" },
    };
    const output = html(pagesOf(source));
    const doc = new DOMParser().parseFromString(output, "text/html");
    expect(doc.querySelector(".p b")).toBeNull();
    expect([...doc.querySelectorAll(".p > .t")].map((span) => span.textContent)).toContain(
      "Ali <b>Valiyev</b> & Co",
    );
    // Rang faqat ikki o'zgaruvchida: siyoh #000, qog'oz #fff (TZ qabul 5).
    expect(output.match(/#[0-9a-f]{3,8}\b/gi)).toEqual(["#000", "#fff"]);
    expect(output).not.toMatch(/rgba?\(|hsla?\(/i);
    expect(output).toContain("--ink:#000;--paper:#fff");
    expect(output).toContain("color-scheme:light only");
  });
});
