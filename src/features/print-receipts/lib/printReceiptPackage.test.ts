import { beforeAll, describe, expect, it } from "vitest";
import { createTestReceiptMeasure, loadTestReceiptFonts } from "../../../test/receiptTestFonts";
import { MM_PER_PT, RECEIPT_FONT_METRICS, type ReceiptMeasure } from "./printReceiptFonts";
import type { ReceiptLabel, ReceiptQrOp, ReceiptRectOp, ReceiptTextOp } from "./printReceiptLayout";
import {
  layoutPackageReceipt,
  toReceiptPackageModel,
  type ReceiptPackageSheet,
  type ReceiptPackageSource,
} from "./printReceiptPackage";

/**
 * HJ5sLHiz — paket va pochta cheki maket `tizim-receipts` 02 bilan: termal 100×60 (1 mm = 5 px) va A5 (1 mm = 3 px),
 * haqiqiy TTF bilan. Koordinatalar maket HTML'idan, ±0,2 mm (matn eniga bog'liq x — ±0,6 mm, kerning yo'q).
 */

let measure: ReceiptMeasure;
beforeAll(async () => {
  measure = createTestReceiptMeasure(await loadTestReceiptFonts());
});

const BATCH: ReceiptPackageSource = {
  kind: "batch",
  id: "172",
  direction: "forward",
  token: "BTB-1a2b3c4d5e6f7a8b",
  createdAt: "2026-10-23T09:15:00.000Z",
  from: "Toshkent HQ",
  to: "Samarqand filiali",
  ordersCount: 48,
  totalPrice: 8_640_000,
  driver: { name: "Aziz Rahimov", phone_number: "998901234567" },
  vehiclePlate: "30 A 456 BC",
};

const POST: ReceiptPackageSource = {
  kind: "post",
  id: "2493",
  token: "POST-1a2b3c4d5e6f7a8b9c",
  createdAt: "2026-10-23T11:40:00.000Z",
  from: "Toshkent HQ",
  to: "Samarqand viloyati",
  ordersCount: 40,
  totalPrice: 7_420_000,
  courier: { name: "Jasur Tursunov", phone_number: "998905554433" },
};

const layout = (source: ReceiptPackageSource, sheet: ReceiptPackageSheet = "thermal") =>
  layoutPackageReceipt(toReceiptPackageModel(source), { measure }, sheet);

const texts = (label: ReceiptLabel) =>
  label.ops.filter((op): op is ReceiptTextOp => op.kind === "text");
const rects = (label: ReceiptLabel) =>
  label.ops.filter((op): op is ReceiptRectOp => op.kind === "rect");
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
const near = (actual: number, expected: number, tolerance = 0.2) =>
  expect(Math.abs(actual - expected), `${actual} ≈ ${expected} ± ${tolerance}`).toBeLessThanOrEqual(
    tolerance + 1e-9,
  );
/** CSS qator qutisidagi bazaviy chiziq (maket: `top` + `line-height`). */
const baseline = (top: number, lineHeight: number, pt: number) =>
  top +
  lineHeight / 2 +
  ((RECEIPT_FONT_METRICS.ascent - RECEIPT_FONT_METRICS.descent) / 2) * pt * MM_PER_PT;

describe("package receipt model (TZ F8)", () => {
  it("badge, number, time (Tashkent), counts and money; driver / courier / vehicle", () => {
    expect(toReceiptPackageModel(BATCH)).toMatchObject({
      badge: "FILIAL PAKETI",
      ref: "B-172",
      date: "23.10.2026, 14:15",
      orders: "48 ta",
      total: "8 640 000 so'm",
      person: { role: "Haydovchi", name: "Aziz Rahimov", phone: "+998 90 123 45 67" },
      vehicle: "30 A 456 BC",
    });
    expect(toReceiptPackageModel({ ...BATCH, direction: "return" }).badge).toBe("QAYTARISH PAKETI");
    expect(toReceiptPackageModel(POST)).toMatchObject({
      badge: "POCHTA",
      ref: "№2493",
      person: { role: "Kuryer", name: "Jasur Tursunov" },
      vehicle: "",
    });
    expect(toReceiptPackageModel({ ...BATCH, id: "B-9" }).ref).toBe("B-9");
  });

  it("missing values are not printed: no «-», no empty rows, no total", () => {
    const model = toReceiptPackageModel({
      kind: "post",
      id: "7",
      from: "—",
      to: null,
      totalPrice: null,
      courier: { name: " ", phone_number: null },
    });
    // Haydovchi / kuryer telefoni «-» / «—» — qator chiqmaydi.
    expect(
      toReceiptPackageModel({
        ...BATCH,
        driver: { name: "—", phone_number: "-" },
        vehiclePlate: "–",
      }),
    ).toMatchObject({ person: null, vehicle: "" });
    expect(
      toReceiptPackageModel({ ...POST, courier: { name: "Jasur", phone_number: " — " } }).person,
    ).toEqual({ role: "Kuryer", name: "Jasur", phone: "" });
    expect(model).toMatchObject({
      from: "",
      to: "",
      total: null,
      person: null,
      qrToken: null,
      date: "",
    });
    const label = layoutPackageReceipt(model, { measure });
    const all = texts(label).map((op) => op.text);
    expect(all).not.toContain("-");
    expect(all).not.toContain("Qayerdan");
    expect(all).not.toContain("Qayerga");
    expect(all).not.toContain("Jami summa");
    expect(all).not.toContain("Kuryer:");
    expect(all).toContain("QR yo'q");
    expect(label.ops.some((op) => op.kind === "qr")).toBe(false);
  });
});

describe("thermal 100×60 — mockup 02 «Yangi — termal»", () => {
  it("filial paketi B-172: coordinates", () => {
    const label = layout(BATCH);
    expect([label.width, label.height]).toEqual([100, 60]);
    const [badge] = rects(label);
    expect(badge).toMatchObject({ x: 2, y: 2, h: 5.2, radius: 1.2 });
    expect(text(label, "FILIAL PAKETI")).toMatchObject({ pt: 8.5, paper: true });
    const date = text(label, "23.10.2026, 14:15");
    expect(date.pt).toBe(8);
    near(date.x + measure(date.text, 8, 700), 67, 0.01);
    const number = text(label, "B-172");
    expect(number.pt).toBe(24);
    near(number.baseline, baseline(8, 9.2, 24));
    expect(rects(label)).toContainEqual({ kind: "rect", x: 2, y: 18, w: 65, h: 0.4 });
    // «Qayerdan» / «Qayerga» — yorliq 7,5 pt, qiymat 11 / 15 pt, bazaviy chiziq bo'yicha (maket: 116,6 va 149,7 px).
    near(text(label, "Qayerdan").baseline, 116.6 / 5);
    expect(text(label, "Toshkent HQ")).toMatchObject({ pt: 11, weight: 600, x: 15.6 });
    near(text(label, "Samarqand filiali").baseline, 149.7 / 5);
    expect(text(label, "Samarqand filiali")).toMatchObject({ pt: 15, weight: 700 });
    near(text(label, "Buyurtmalar").baseline, baseline(32.4, 3.2, 7.5));
    expect(text(label, "48 ta").pt).toBe(14);
    near(text(label, "48 ta").baseline, baseline(35.6, 5.6, 14));
    expect(text(label, "8 640 000 so'm").pt).toBe(11);
    near(text(label, "Haydovchi:").baseline, baseline(42.4, 3.6, 8));
    expect(text(label, "Aziz Rahimov · +998 90 123 45 67").weight).toBe(700);
    near(text(label, "Avtomobil:").baseline, baseline(46, 3.6, 8));
    // QR: 7 nuqta × 29 modul (V3-H) = 25,4 mm, x 70,8 y 4,4.
    const qr = label.ops.find((op): op is ReceiptQrOp => op.kind === "qr")!;
    expect(qr.symbol).toMatchObject({ version: 3, count: 29 });
    near(qr.module, 0.875, 0.001);
    near(qr.x, 70.8, 0.05);
    near(qr.y, 4.4, 0.05);
    near(text(label, "Qabul qilishda").baseline, baseline(33.6, 3, 7.5));
    near(text(label, "skanerlang").baseline, baseline(36.6, 3, 7.5));
    // Imzo qatori: matn 54,4–58 mm, chiziqlar 57 mm da, «Imzo» chizig'i 22 mm (x 76–98).
    near(text(label, "Qabul qildi:").baseline, baseline(54.4, 3.6, 8));
    expect(rects(label)).toContainEqual({ kind: "rect", x: 76, y: 57, w: 22, h: 0.2 });
  });

  it("pochta №2493: «Kuryer:» line, no vehicle; POST- token → V3", () => {
    const label = layout(POST);
    expect(text(label, "POCHTA").paper).toBe(true);
    expect(text(label, "№2493").pt).toBe(24);
    expect(text(label, "Jasur Tursunov · +998 90 555 44 33").weight).toBe(700);
    expect(texts(label).map((op) => op.text)).not.toContain("Avtomobil:");
    expect(label.ops.find((op): op is ReceiptQrOp => op.kind === "qr")!.symbol.version).toBe(3);
  });

  it("long branch name is shortened with «…», the driver's phone stays whole, every op stays on the label", () => {
    const label = layout({
      ...BATCH,
      to: "Qoraqalpog'iston Respublikasi Nukus shahar markaziy filiali",
      driver: {
        name: "Abdurahmonov Abdulaziz Abdulazizxon o'g'li Toshkentlik",
        phone_number: "998901234567",
      },
    });
    const to = texts(label).find((op) => op.pt === 15)!;
    expect(to.text.endsWith("…")).toBe(true);
    expect(to.x + measure(to.text, 15, 700)).toBeLessThanOrEqual(67 + 1e-6);
    const driver = texts(label).find((op) => op.text.endsWith("+998 90 123 45 67"))!;
    expect(driver.text).toContain("…");
    expect(driver.x + measure(driver.text, 8, 700)).toBeLessThanOrEqual(67 + 1e-6);
    for (const op of texts(label)) {
      expect(op.x).toBeGreaterThanOrEqual(2 - 1e-6);
      expect(op.x + measure(op.text, op.pt, op.weight)).toBeLessThanOrEqual(98 + 1e-6);
    }
  });
});

describe("A5 — mockup 02 «Yangi — A5 varaq»", () => {
  it("same fields, enlarged: number 40 pt, to 28 pt, 60 mm QR on the right, signature at the bottom", () => {
    const label = layout(BATCH, "a5");
    expect([label.width, label.height]).toEqual([148, 210]);
    const [badge] = rects(label);
    expect(badge).toMatchObject({ x: 10, y: 10, radius: 2 });
    near(badge.h, 32 / 3);
    expect(text(label, "FILIAL PAKETI").pt).toBe(14);
    const date = text(label, "23.10.2026, 14:15");
    near(date.x + measure(date.text, 12, 700), 138, 0.01);
    const number = text(label, "B-172");
    expect(number.pt).toBe(40);
    near(number.baseline, baseline(24, 16, 40));
    expect(rects(label)).toContainEqual({ kind: "rect", x: 10, y: 42.667, w: 128, h: 1 });
    expect(text(label, "Toshkent HQ")).toMatchObject({ pt: 18, x: 46 });
    expect(text(label, "Samarqand filiali")).toMatchObject({ pt: 28, x: 46 });
    // Bo'lim chizig'i 75,67 mm, ichi 87,33 mm dan: chapda raqamlar, o'ngda 60 mm QR.
    const sectionRule = rects(label).find((rect) => rect.w === 128 && rect.h < 0.5)!;
    near(sectionRule.y, 75.667);
    const qr = label.ops.find((op): op is ReceiptQrOp => op.kind === "qr")!;
    near(qr.module * qr.symbol.count, 60, 0.001);
    near(qr.x, 78, 0.01);
    near(qr.y, 87.333);
    near(text(label, "Buyurtmalar").baseline, baseline(87.333, 6, 12));
    expect(text(label, "48 ta").pt).toBe(24);
    expect(text(label, "8 640 000 so'm").pt).toBe(18);
    expect(texts(label).map((op) => op.text)).toEqual(
      expect.arrayContaining(["Haydovchi", "Aziz Rahimov", "+998 90 123 45 67", "30 A 456 BC"]),
    );
    const scan = text(label, "Qabul qilishda skanerlang");
    near(scan.x + measure(scan.text, 12, 600) / 2, 108, 0.01);
    near(scan.baseline, baseline(87.333 + 60 + 34 / 3, 6, 12));
    near(text(label, "Qabul qildi:").baseline, baseline(194, 6, 12));
    expect(rects(label)).toContainEqual({ kind: "rect", x: 108, y: 198.333, w: 30, h: 0.333 });
  });

  it("a long destination wraps instead of being cut", () => {
    const label = layout({ ...POST, to: "Qoraqalpog'iston Respublikasi Nukus shahri" }, "a5");
    const lines = texts(label).filter((op) => op.pt === 28);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((op) => op.text).join(" ")).toBe("Qoraqalpog'iston Respublikasi Nukus shahri");
    for (const op of lines)
      expect(op.x + measure(op.text, 28, 700)).toBeLessThanOrEqual(138 + 1e-6);
  });
});
