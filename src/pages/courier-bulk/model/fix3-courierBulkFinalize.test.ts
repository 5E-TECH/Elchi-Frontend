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
 * Sukut natija yo'q (ega 2026-11-05): belgilanmagan buyurtma uchun ham so'rov
 * ketmaydi — "ertaga" kabi kutilmoqda qoladi. Sotiladigani aniq "sotildi"
 * belgilanadi.
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

  it("belgilanmagan buyurtma uchun vazifa yaratilmaydi — sukut 'sotildi' yo'q, 'ertaga' kabi o'zgarmaydi", () => {
    // #1 va #4 belgilanmagan: ilgari ular sukut bo'yicha sotilib ketardi.
    const unmarkedActions: Record<string, CourierBulkAction> = { "2": "cancel", "3": "tomorrow" };

    expect(getCourierBulkFinalizeTasks(orders, unmarkedActions)).toEqual([{ order: { id: "2" }, action: "cancel" }]);
    expect(getCourierBulkKept(orders, unmarkedActions)).toEqual({
      unmarked: [{ id: "1" }, { id: "4" }],
      tomorrow: [{ id: "3" }],
      replacement: [],
      courierHeld: [],
      awaitingPost: [],
    });
  });

  it("hammasi 'ertaga' bo'lsa — vazifa yo'q", () => {
    expect(
      getCourierBulkFinalizeTasks([{ id: "7" }], { "7": "tomorrow" }),
    ).toEqual([]);
  });

  it("hech biri belgilanmagan bo'lsa — vazifa yo'q", () => {
    expect(getCourierBulkFinalizeTasks([{ id: "7" }, { id: "8" }], {})).toEqual([]);
  });

  it("20 tadan 10 tasi 'sotildi' belgilansa — faqat o'sha 10 tasi sotiladi, qolgan 10 tasi o'zgarmaydi", () => {
    const twenty = Array.from({ length: 20 }, (_, index) => ({ id: String(index + 1) }));
    const soldIds = twenty.slice(0, 10).map((order) => order.id);
    const soldActions = Object.fromEntries(soldIds.map((id) => [id, "sold"])) as Record<string, CourierBulkAction>;

    const tasks = getCourierBulkFinalizeTasks(twenty, soldActions);

    expect(tasks).toHaveLength(10);
    expect(tasks.map((task) => task.order.id)).toEqual(soldIds);
    expect(tasks.every((task) => task.action === "sold")).toBe(true);
    expect(getCourierBulkKept(twenty, soldActions).unmarked).toEqual(twenty.slice(10));
  });

  it("25 tadan 10 'sotildi', 5 'bekor', 5 'ertaga' — faqat 15 ta so'rov, 5 belgilanmagan o'zgarmaydi", () => {
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

    // Ilgari #21–#25 (belgilanmagan) ham "sotildi" bo'lib 20 ta so'rov ketardi.
    expect(tasks).toEqual([
      ...orders25.slice(0, 10).map((order) => ({ order, action: "sold" })),
      ...orders25.slice(10, 15).map((order) => ({ order, action: "cancel" })),
    ]);
    expect(kept).toEqual({
      unmarked: orders25.slice(20),
      tomorrow: orders25.slice(15, 20),
      replacement: [],
      courierHeld: [],
      awaitingPost: [],
    });
    expect(getCourierBulkUnmarkedCount(orders25, markedActions)).toBe(5);
    expect(getCourierBulkCounts(orders25, markedActions)).toEqual({ cancel: 5, sold: 10, tomorrow: 5, total: 25 });
  });

  it("qisman xato: bajarilganlar tozalanadi, xato bergan 'bekor' va 'ertaga' saqlanadi", () => {
    const next = getCourierBulkActionsAfterFinalize(
      { "1": "sold", "2": "cancel", "3": "tomorrow", "5": "cancel" },
      new Set(["1", "5"]),
    );

    // #1 va #5 bajarildi — belgisi ketdi; #2 xato berdi — qayta urinishda yana
    // "bekor" bo'lib qoladi (sotilib ketmaydi); #3 ertaga — saqlanadi.
    expect(next).toEqual({ "2": "cancel", "3": "tomorrow" });
    // Qayta urinish: #2 yana "bekor" bo'lib ketadi, #3 ("ertaga") va #4 (belgilanmagan) — so'rovsiz.
    expect(getCourierBulkFinalizeTasks([{ id: "2" }, { id: "3" }, { id: "4" }], next)).toEqual([
      { order: { id: "2" }, action: "cancel" },
    ]);
  });

  it("to'liq muvaffaqiyat: faqat 'ertaga' belgilari qoladi (qayta bosilsa ham so'rov ketmaydi)", () => {
    const next = getCourierBulkActionsAfterFinalize(actions, new Set(["1", "2", "4"]));

    expect(next).toEqual({ "3": "tomorrow" });
    expect(getCourierBulkFinalizeTasks([{ id: "3" }], next)).toEqual([]);
  });
});
