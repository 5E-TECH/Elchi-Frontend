import { describe, expect, it } from "vitest";
import {
  getCourierBulkActionsAfterFinalize,
  getCourierBulkCounts,
  getCourierBulkFinalizeTasks,
  getCourierBulkKept,
  getCourierBulkUnmarkedCount,
  type CourierBulkAction,
} from "./courierBulk";

/**
 * fix3 FE-CB-09 — "Ertaga" belgisi API ga ketmaydi (could-not-deliver faqat
 * ON_THE_ROAD ni qabul qiladi, bu ro'yxat esa WAITING), va qisman xatoda
 * bajarilganlarning belgisi tozalanadi.
 *
 * BeePost modeli (ega 2026-11-21; 2026-11-05 dagi «sukut yo'q» qarori bekor):
 * belgilanmagan buyurtma — sukut "sotildi", unga ham sotish vazifasi yaratiladi.
 * So'rovsiz faqat "ertaga" (va almashtirish) qoladi.
 */
describe("courier bulk finalize (fix3 FE-CB-09)", () => {
  const orders = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
  const actions: Record<string, CourierBulkAction> = { "1": "sold", "2": "cancel", "3": "tomorrow", "4": "sold" };

  it("'ertaga' buyurtma uchun vazifa yaratilmaydi, aniq 'sotildi' va 'bekor' yuboriladi", () => {
    expect(getCourierBulkFinalizeTasks(orders, actions)).toEqual([
      { order: { id: "1" }, action: "sold" },
      { order: { id: "2" }, action: "cancel" },
      { order: { id: "4" }, action: "sold" },
    ]);
  });

  it("belgilanmagan buyurtma — sukut 'sotildi': unga ham sotish vazifasi yaratiladi, faqat 'ertaga' qoladi", () => {
    // #1 va #4 belgilanmagan: BeePost'dagidek sotiladi (ilgari — 2026-11-05 dan — so'rovsiz qolardi).
    const unmarkedActions: Record<string, CourierBulkAction> = { "2": "cancel", "3": "tomorrow" };

    expect(getCourierBulkFinalizeTasks(orders, unmarkedActions)).toEqual([
      { order: { id: "1" }, action: "sold" },
      { order: { id: "2" }, action: "cancel" },
      { order: { id: "4" }, action: "sold" },
    ]);
    expect(getCourierBulkKept(orders, unmarkedActions)).toEqual({
      tomorrow: [{ id: "3" }],
      replacement: [],
    });
  });

  it("hammasi 'ertaga' bo'lsa — vazifa yo'q", () => {
    expect(
      getCourierBulkFinalizeTasks([{ id: "7" }], { "7": "tomorrow" }),
    ).toEqual([]);
  });

  it("hech biri belgilanmagan bo'lsa — hammasi 'sotildi' vazifasi", () => {
    expect(getCourierBulkFinalizeTasks([{ id: "7" }, { id: "8" }], {})).toEqual([
      { order: { id: "7" }, action: "sold" },
      { order: { id: "8" }, action: "sold" },
    ]);
  });

  it("20 tadan 10 tasi aniq 'sotildi', 10 tasi belgilanmagan — 20 tasi ham sotiladi", () => {
    const twenty = Array.from({ length: 20 }, (_, index) => ({ id: String(index + 1) }));
    const soldIds = twenty.slice(0, 10).map((order) => order.id);
    const soldActions = Object.fromEntries(soldIds.map((id) => [id, "sold"])) as Record<string, CourierBulkAction>;

    const tasks = getCourierBulkFinalizeTasks(twenty, soldActions);

    expect(tasks).toHaveLength(20);
    expect(tasks.map((task) => task.order.id)).toEqual(twenty.map((order) => order.id));
    expect(tasks.every((task) => task.action === "sold")).toBe(true);
    expect(getCourierBulkKept(twenty, soldActions)).toEqual({ tomorrow: [], replacement: [] });
    // «Belgilanmagan» soni — tasdiq oynasidagi belgilash katagi uchun (ular ham sotiladi).
    expect(getCourierBulkUnmarkedCount(twenty, soldActions)).toBe(10);
  });

  it("25 tadan 10 'sotildi', 5 'bekor', 5 'ertaga', 5 belgilanmagan — 20 ta so'rov, faqat 5 'ertaga' qoladi", () => {
    const orders25 = Array.from({ length: 25 }, (_, index) => ({ id: String(index + 1) }));
    const markOf = (index: number): CourierBulkAction | null =>
      index < 10 ? "sold" : index < 15 ? "cancel" : index < 20 ? "tomorrow" : null;
    const markedActions = Object.fromEntries(
      orders25.flatMap((order, index) => {
        const mark = markOf(index);
        return mark ? [[order.id, mark]] : [];
      }),
    ) as Record<string, CourierBulkAction>;

    const tasks = getCourierBulkFinalizeTasks(orders25, markedActions);
    const kept = getCourierBulkKept(orders25, markedActions);

    // #21–#25 (belgilanmagan) sukut bo'yicha "sotildi" — sahifa tartibida.
    expect(tasks).toEqual([
      ...orders25.slice(0, 10).map((order) => ({ order, action: "sold" })),
      ...orders25.slice(10, 15).map((order) => ({ order, action: "cancel" })),
      ...orders25.slice(20).map((order) => ({ order, action: "sold" })),
    ]);
    expect(kept).toEqual({
      tomorrow: orders25.slice(15, 20),
      replacement: [],
    });
    expect(getCourierBulkUnmarkedCount(orders25, markedActions)).toBe(5);
    expect(getCourierBulkCounts(orders25, markedActions)).toEqual({ cancel: 5, sold: 15, tomorrow: 5, total: 25 });
  });

  it("qisman xato: bajarilganlar tozalanadi, xato bergan 'bekor' va 'ertaga' saqlanadi", () => {
    const next = getCourierBulkActionsAfterFinalize(
      { "1": "sold", "2": "cancel", "3": "tomorrow", "5": "cancel" },
      new Set(["1", "5"]),
    );

    // #1 va #5 bajarildi — belgisi ketdi; #2 xato berdi — qayta urinishda yana
    // "bekor" bo'lib qoladi (sotilib ketmaydi); #3 ertaga — saqlanadi.
    expect(next).toEqual({ "2": "cancel", "3": "tomorrow" });
    // Qayta urinish: #2 yana "bekor", #3 ("ertaga") — so'rovsiz, #4 (belgilanmagan) — sukut "sotildi".
    expect(getCourierBulkFinalizeTasks([{ id: "2" }, { id: "3" }, { id: "4" }], next)).toEqual([
      { order: { id: "2" }, action: "cancel" },
      { order: { id: "4" }, action: "sold" },
    ]);
  });

  it("to'liq muvaffaqiyat: faqat 'ertaga' belgilari qoladi (qayta bosilsa ham so'rov ketmaydi)", () => {
    const next = getCourierBulkActionsAfterFinalize(actions, new Set(["1", "2", "4"]));

    expect(next).toEqual({ "3": "tomorrow" });
    expect(getCourierBulkFinalizeTasks([{ id: "3" }], next)).toEqual([]);
  });
});
