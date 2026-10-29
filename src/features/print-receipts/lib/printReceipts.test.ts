import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { receiptDiskFontLoader } from "../../../test/receiptTestFonts";
import { countReceiptsWithoutQr, ReceiptFontError, receiptPackageWithoutQr } from "../index";
import { loadReceiptFontData, resetReceiptFontCache } from "./printReceiptFonts";
import {
  buildOrderReceiptPages,
  createReceiptMeasure,
  printOrderReceipts,
  printPackageReceipt,
  RECEIPT_JOB_LIMIT,
} from "./printReceipts";
import type { ReceiptPackageSource } from "./printReceiptPackage";
import type { ReceiptLabel } from "./printReceiptLayout";
import { createReceiptScheduler, RECEIPT_SLICE_MS } from "./receiptScheduler";
import { RECEIPT_SAMPLES } from "./receiptSamples";

/** HJ5sLHiz — chop etish yo'li (TZ F9): bitta `ReceiptPage[]`, 200 taliklab ish, PDF oynasi / yuklab olish, shrift xatosi. */

const printed = vi.hoisted(() => ({ html: [] as string[] }));
vi.mock("./printReceiptHtml", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./printReceiptHtml")>()),
  printReceiptHtml: vi.fn(async (html: string) => {
    printed.html.push(html);
  }),
}));

/** Hujjatdagi ko'rinadigan matn (teglar va `<style>` siz). */
const visibleText = (html: string) =>
  new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";

beforeAll(async () => {
  // Brauzer `fetch` o'rniga diskdagi TTF — modul keshiga oldindan yuklanadi.
  resetReceiptFontCache();
  await loadReceiptFontData(receiptDiskFontLoader);
});

beforeEach(() => {
  printed.html = [];
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:receipt");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("printOrderReceipts", () => {
  it("PDF: opens the document in a new window (without noopener)", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue({} as Window);
    const result = await printOrderReceipts([RECEIPT_SAMPLES.main, RECEIPT_SAMPLES.e], {
      output: "pdf",
    });
    expect(result).toMatchObject({
      orders: 2,
      pages: 3,
      jobs: 1,
      withoutQr: 0,
      delivery: ["opened"],
    });
    expect(open).toHaveBeenCalledWith("blob:receipt", "_blank");
  });

  it("PDF: popup blocked → the file is saved instead (jsPDF `save`)", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    // vitest jsPDF'ning Node build'ini oladi — `save` faylni diskka yozadi: vaqtinchalik papkaga.
    const fileName = join(tmpdir(), `elchi-receipt-${process.pid}-${Date.now()}`);
    try {
      const result = await printOrderReceipts([RECEIPT_SAMPLES.f], { output: "pdf", fileName });
      expect(open).toHaveBeenCalledTimes(1);
      expect(result.delivery).toEqual(["saved"]);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:receipt");
      expect(readFileSync(`${fileName}.pdf`, "latin1").startsWith("%PDF-")).toBe(true);
    } finally {
      rmSync(`${fileName}.pdf`, { force: true });
    }
  });

  it("browser: prints the same pages through the hidden-iframe HTML", async () => {
    const result = await printOrderReceipts(
      [RECEIPT_SAMPLES.main, { ...RECEIPT_SAMPLES.f, qr_code_token: null }],
      {
        output: "browser",
      },
    );
    expect(result).toMatchObject({ pages: 2, withoutQr: 1, delivery: ["printed"] });
    expect(printed.html).toHaveLength(1);
    expect(printed.html[0].match(/class="p"/g)).toHaveLength(2);
    // Matn kerning joylarida `<span>` larga bo'lingan — ko'rinadigan matn bo'yicha tekshiriladi.
    expect(visibleText(printed.html[0])).toContain("QR yo'q");
  });

  it("more than 200 orders → jobs of 200 (continuation labels do not count)", async () => {
    const orders = Array.from({ length: RECEIPT_JOB_LIMIT + 1 }, (_, index) => ({
      ...RECEIPT_SAMPLES.f,
      id: String(30_000 + index),
    }));
    const result = await printOrderReceipts(orders, { output: "browser" });
    expect(result).toMatchObject({ orders: 201, pages: 201, jobs: 2 });
    expect(printed.html.map((html) => html.match(/class="p"/g)?.length)).toEqual([200, 1]);
  }, 20_000);

  it("A4: 13 orders → two A4 pages (12 + 1) in one job", async () => {
    const orders = Array.from({ length: 13 }, (_, index) => ({
      ...RECEIPT_SAMPLES.f,
      id: String(700 + index),
    }));
    const result = await printOrderReceipts(orders, { output: "browser", sheet: "a4" });
    expect(result).toMatchObject({ orders: 13, pages: 2, jobs: 1, delivery: ["printed"] });
    expect(printed.html[0]).toContain("@page{size:210mm 297mm;margin:0}");
    expect(printed.html[0].match(/class="p"/g)).toHaveLength(2);
  });

  it("leading mail receipt (ega qarori 5): the post page first, then the order receipts — one job", async () => {
    const result = await printOrderReceipts([RECEIPT_SAMPLES.main, RECEIPT_SAMPLES.f], {
      output: "browser",
      leadingPackage: POST,
    });
    expect(result).toMatchObject({ orders: 2, pages: 3, jobs: 1 });
    const html = visibleText(printed.html[0]);
    expect(html.indexOf("POCHTA")).toBeGreaterThan(-1);
    expect(html.indexOf("POCHTA")).toBeLessThan(html.indexOf("№10241"));
    await expect(
      printOrderReceipts([RECEIPT_SAMPLES.main], {
        output: "browser",
        sheet: "a4",
        leadingPackage: POST,
      }),
    ).rejects.toThrow();
  });

  it("time-sliced (TZ qabul 8): layout, PDF drawing and HTML yield to the event loop every ≤ 32 ms of work", async () => {
    vi.spyOn(window, "open").mockReturnValue({} as Window);
    // Soxta soat: har o'qish — 8 ms ish. Navbatlar orasidagi «ish» hech qachon bo'lak + bitta birlikdan oshmaydi.
    let time = 0;
    const now = () => (time += 8);
    const gaps: number[] = [];
    let sliceStart = 0;
    const yieldTo = vi.fn(async () => {
      gaps.push(time - sliceStart);
      await Promise.resolve();
      sliceStart = time;
    });
    const orders = Array.from({ length: 40 }, (_, index) => ({
      ...RECEIPT_SAMPLES.f,
      id: String(40_000 + index),
    }));

    const pdfScheduler = createReceiptScheduler({ now, yieldTo });
    const pdf = await printOrderReceipts(orders, { output: "pdf", scheduler: pdfScheduler });
    expect(pdf).toMatchObject({ pages: 40, delivery: ["opened"] });
    // 40 ta joylash + 40 ta PDF sahifa (80 birlik × 8 ms) → har 4 birlikda navbat.
    expect(pdfScheduler.yields).toBeGreaterThanOrEqual(16);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(RECEIPT_SLICE_MS + 8);

    const htmlScheduler = createReceiptScheduler({ now, yieldTo });
    await printOrderReceipts(orders, { output: "browser", scheduler: htmlScheduler });
    expect(htmlScheduler.yields).toBeGreaterThanOrEqual(16);
    expect(printed.html).toHaveLength(1);
  });

  it("the layout loop yields by time, not by a fixed count: a slow order yields right after it", async () => {
    const measure = createReceiptMeasure(await loadReceiptFontData());
    let time = 0;
    const yieldTo = vi.fn(() => Promise.resolve());
    const scheduler = createReceiptScheduler({ now: () => time, yieldTo });
    const seen: number[] = [];
    await buildOrderReceiptPages(
      [RECEIPT_SAMPLES.f, RECEIPT_SAMPLES.e, RECEIPT_SAMPLES.f, RECEIPT_SAMPLES.f],
      measure,
      {
        scheduler,
        labelsAfterOrder: (_order, model) => {
          // 2-buyurtma (01.B e) «sekin» — 50 ms; qolganlari 1 ms.
          time += model.id === "104127" ? 50 : 1;
          seen.push(yieldTo.mock.calls.length);
          return [];
        },
      },
    );
    expect(seen).toEqual([0, 0, 1, 1]);
    expect(scheduler.yields).toBe(1);
  });

  it("nothing to print → no work", async () => {
    const open = vi.spyOn(window, "open");
    expect(await printOrderReceipts([], { output: "pdf" })).toMatchObject({
      pages: 0,
      jobs: 0,
      delivery: [],
    });
    expect(open).not.toHaveBeenCalled();
  });
});

const POST: ReceiptPackageSource = {
  kind: "post",
  id: "2493",
  token: "POST-1a2b3c4d5e6f7a8b9c",
  createdAt: "2026-10-23T11:40:00.000Z",
  to: "Samarqand viloyati",
  ordersCount: 2,
  totalPrice: 249_000,
};

describe("printPackageReceipt", () => {
  it("thermal (browser) and A5 (PDF): one page each, page size from the sheet", async () => {
    const thermal = await printPackageReceipt(POST, { output: "browser" });
    expect(thermal).toMatchObject({ pages: 1, jobs: 1, withoutQr: 0, delivery: ["printed"] });
    expect(printed.html[0]).toContain("@page{size:100mm 60mm;margin:0}");
    expect(printed.html[0]).toContain("№2493");

    vi.spyOn(window, "open").mockReturnValue({} as Window);
    const a5 = await printPackageReceipt(
      { ...POST, kind: "batch", id: "172", token: null },
      { output: "pdf", sheet: "a5" },
    );
    expect(a5).toMatchObject({ pages: 1, withoutQr: 1, delivery: ["opened"] });
  });
});

describe("building pages", () => {
  it("labels from the T8 hook are inserted right after their order", async () => {
    const measure = createReceiptMeasure(await loadReceiptFontData());
    const marker = (id: string): ReceiptLabel => ({
      width: 100,
      height: 60,
      ops: [{ kind: "text", x: 2, baseline: 10, pt: 12, weight: 700, text: `kategoriya ${id}` }],
    });
    const sheets: string[] = [];
    const pages = await buildOrderReceiptPages([RECEIPT_SAMPLES.e, RECEIPT_SAMPLES.f], measure, {
      labelsAfterOrder: (_order, model, _measure, sheet) => {
        sheets.push(sheet);
        return [marker(model.id)];
      },
    });
    expect(sheets).toEqual(["thermal", "thermal"]);
    const firstText = (index: number) => pages[index].ops.find((op) => op.kind === "text");
    expect(pages).toHaveLength(5);
    expect(firstText(2)).toMatchObject({ text: "kategoriya 104127" });
    expect(firstText(4)).toMatchObject({ text: "kategoriya 10270" });
  });

  it("counts orders without a QR token for the «N ta buyurtmada QR yo'q» warning", () => {
    expect(
      countReceiptsWithoutQr([
        { qr_code_token: "abc" },
        { qr_code_token: " " },
        { qr_code_token: null },
        {},
      ]),
    ).toBe(3);
  });
});

describe("package receipt QR warning (useReceiptPrint → packageWithoutQr)", () => {
  it("a package / mail without a token → its kind; with a token → null", () => {
    expect(receiptPackageWithoutQr({ kind: "batch", token: null })).toBe("batch");
    expect(receiptPackageWithoutQr({ kind: "batch", token: " " })).toBe("batch");
    expect(receiptPackageWithoutQr({ kind: "post" })).toBe("post");
    expect(receiptPackageWithoutQr({ kind: "post", token: "POST-1a2b3c4d5e6f7a8b9c" })).toBeNull();
  });
});

describe("fonts", () => {
  it("a failed font download rejects with ReceiptFontError and is retried on the next call", async () => {
    resetReceiptFontCache();
    await expect(
      loadReceiptFontData(() => Promise.reject(new Error("offline"))),
    ).rejects.toBeInstanceOf(ReceiptFontError);
    await expect(loadReceiptFontData(receiptDiskFontLoader)).resolves.toBeTruthy();
  });
});
