import { describe, expect, it } from "vitest";
import { normalizeWarehouseProduct, type WarehouseLookupItem } from "../../../../entities/warehouse";
import { rawProduct } from "../../../../test/warehouseFixtures";
import { issueLines, itemLines, linesFingerprint, scanLinesReducer, totalQty, type ScanLine } from "./scanLines";

const item = (id: string, stock: WarehouseLookupItem["stock"] = null): WarehouseLookupItem => ({
  product: normalizeWarehouseProduct(rawProduct({ id, name: `Mahsulot ${id}` })),
  market: { id: "121", name: "Baraka Shop" },
  stock,
});

const run = (...actions: Parameters<typeof scanLinesReducer>[1][]) =>
  actions.reduce<ScanLine[]>((lines, action) => scanLinesReducer(lines, action), []);

describe("skan ro'yxati (kirim / inventarizatsiya)", () => {
  it("yangi mahsulot — 1 dona, oxirgi skan yuqorida; qayta skan — +1 va «qayta skan» belgisi", () => {
    const lines = run({ type: "item", item: item("1") }, { type: "item", item: item("2") }, { type: "item", item: item("1") });
    expect(lines.map((line) => line.key)).toEqual(["1", "2"]);
    expect(itemLines(lines)[0]).toMatchObject({ qty: 2, badge: "rescan" });
    expect(totalQty(lines)).toBe(3);
  });

  it("muammo qatori — kod bo'yicha bitta; hal bo'lsa (bog'landi) muammo olinadi, belgi «Kod bog'landi»", () => {
    let lines = run({ type: "issue", kind: "unlinked", code: "4780012345677" }, { type: "issue", kind: "unlinked", code: "4780012345677" });
    expect(issueLines(lines)).toHaveLength(1);
    lines = scanLinesReducer(lines, { type: "item", item: item("7"), resolves: "4780012345677", badge: "linked" });
    expect(issueLines(lines)).toHaveLength(0);
    expect(itemLines(lines)[0]).toMatchObject({ key: "7", qty: 1, badge: "linked" });
  });

  it("miqdor 0…100 000 oralig'ida, qo'lda o'zgartirish belgini olib tashlaydi; olib tashlash va tozalash", () => {
    let lines = run({ type: "item", item: item("1") }, { type: "item", item: item("1") });
    lines = scanLinesReducer(lines, { type: "qty", key: "1", qty: 250_000 });
    expect(itemLines(lines)[0]).toMatchObject({ qty: 100_000, badge: null });
    lines = scanLinesReducer(lines, { type: "qty", key: "1", qty: -5 });
    expect(itemLines(lines)[0].qty).toBe(0);
    expect(scanLinesReducer(lines, { type: "remove", key: "1" })).toEqual([]);
    expect(scanLinesReducer(lines, { type: "reset" })).toEqual([]);
  });

  it("barmoq izi skan tartibiga bog'liq emas, tarkib va izohga bog'liq", () => {
    const a = run({ type: "item", item: item("1") }, { type: "item", item: item("2") });
    const b = run({ type: "item", item: item("2") }, { type: "item", item: item("1") });
    expect(linesFingerprint(a, { note: "" })).toBe(linesFingerprint(b, { note: "" }));
    expect(linesFingerprint(a, { note: "x" })).not.toBe(linesFingerprint(a, { note: "" }));
    expect(linesFingerprint(scanLinesReducer(a, { type: "qty", key: "1", qty: 5 }))).not.toBe(linesFingerprint(a));
  });
});
