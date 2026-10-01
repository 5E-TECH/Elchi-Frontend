import { describe, expect, it } from "vitest";
import {
  getCourierBulkActionsAfterFinalize,
  getCourierBulkFinalizeTasks,
  type CourierBulkAction,
} from "./courierBulk";

/**
 * fix3 FE-CB-09 — "Ertaga" belgisi API ga ketmaydi (could-not-deliver faqat
 * ON_THE_ROAD ni qabul qiladi, bu ro'yxat esa WAITING), va qisman xatoda
 * bajarilganlarning belgisi tozalanadi.
 */
describe("courier bulk finalize (fix3 FE-CB-09)", () => {
  const orders = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
  const actions: Record<string, CourierBulkAction> = { "2": "cancel", "3": "tomorrow" };

  it("'ertaga' buyurtma uchun vazifa yaratilmaydi, qolganlari sukut bo'yicha sotiladi", () => {
    expect(getCourierBulkFinalizeTasks(orders, actions)).toEqual([
      { order: { id: "1" }, action: "sold" },
      { order: { id: "2" }, action: "cancel" },
      { order: { id: "4" }, action: "sold" },
    ]);
  });

  it("hammasi 'ertaga' bo'lsa — vazifa yo'q", () => {
    expect(
      getCourierBulkFinalizeTasks([{ id: "7" }], { "7": "tomorrow" }),
    ).toEqual([]);
  });

  it("qisman xato: bajarilganlar tozalanadi, xato bergan 'bekor' va 'ertaga' saqlanadi", () => {
    const next = getCourierBulkActionsAfterFinalize(
      { "2": "cancel", "3": "tomorrow", "5": "cancel" },
      new Set(["1", "5"]),
    );

    // #5 bajarildi — belgisi ketdi; #2 xato berdi — qayta urinishda yana
    // "bekor" bo'lib qoladi (sotilib ketmaydi); #3 ertaga — saqlanadi.
    expect(next).toEqual({ "2": "cancel", "3": "tomorrow" });
  });

  it("to'liq muvaffaqiyat: faqat 'ertaga' belgilari qoladi (qayta bosilsa sotilib ketmasin)", () => {
    const next = getCourierBulkActionsAfterFinalize(actions, new Set(["1", "2", "4"]));

    expect(next).toEqual({ "3": "tomorrow" });
  });
});
