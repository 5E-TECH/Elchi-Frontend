import { describe, expect, it } from "vitest";
import { canLookupBranches, canLookupUsers, readOrderMeta, telHref, visibleTariffs } from "./orderMeta";

/** Karta dalilidagi `GET /orders/95` javobi (kerakli maydonlar). */
const ORDER_95 = {
  id: "95",
  status: "sold",
  where_deliver: "center",
  market: { id: "m7", name: "Kimdur Kimdur", phone_number: "+998992222222" },
  market_tariff: 70000,
  courier_tariff: 25000,
  courier_share: 25000,
  branch_share: 0,
  courier_id: "93",
  post_id: "78",
  holder_type: "COURIER",
  holder_branch_id: null,
  holder_courier_id: "93",
  sold_at: "1784557174975",
  createdAt: "2026-07-20T08:38:49.865Z",
  branch: { id: "1", name: "HQ Toshkent" },
  parent_order_id: null,
};

describe("readOrderMeta", () => {
  it("⭐ #95 javobi to'liq o'qiladi", () => {
    const meta = readOrderMeta(ORDER_95)!;
    expect(meta.id).toBe("95");
    expect(meta.market).toEqual({ id: "m7", name: "Kimdur Kimdur", phone: "+998992222222" });
    expect(meta.branch).toEqual({ id: "1", name: "HQ Toshkent" });
    expect(meta.postId).toBe("78");
    expect(meta.courierId).toBe("93");
    expect(meta.holderType).toBe("COURIER");
    expect(meta.holderCourierId).toBe("93");
    expect(meta.whereDeliver).toBe("center");
    expect(meta.tariffs).toEqual({ marketTariff: 70000, courierTariff: 25000, courierShare: 25000, branchShare: 0 });
    // Epoch ms SATR — sana sifatida o'qiladi.
    expect(meta.soldAt?.getTime()).toBe(1784557174975);
    expect(meta.parentOrderId).toBeNull();
  });

  it("⭐ yo'q / buzuq tarif `null` — HECH QACHON 0 emas; `0` esa haqiqiy 0", () => {
    const meta = readOrderMeta({ id: 1, market_tariff: "70000.00", courier_tariff: null, courier_share: "abc", branch_share: 0 })!;
    expect(meta.tariffs).toEqual({ marketTariff: 70000, courierTariff: null, courierShare: null, branchShare: 0 });
  });

  it("noma'lum holder turi va yetkazish turi — `null`; sold_at yo'q — `null`", () => {
    const meta = readOrderMeta({ id: "5", holder_type: "SPACE", where_deliver: "moon", sold_at: null })!;
    expect(meta.holderType).toBeNull();
    expect(meta.whereDeliver).toBeNull();
    expect(meta.soldAt).toBeNull();
  });

  it("ISO sana ham o'qiladi; parent_order_id raqam bo'lsa satrga aylanadi", () => {
    const meta = readOrderMeta({ id: "96", sold_at: "2026-07-20T08:40:00.000Z", parent_order_id: 95 })!;
    expect(meta.soldAt?.toISOString()).toBe("2026-07-20T08:40:00.000Z");
    expect(meta.parentOrderId).toBe("95");
  });

  it("id'siz yoki obyekt bo'lmagan javob — `null` (widget chizilmaydi)", () => {
    expect(readOrderMeta(null)).toBeNull();
    expect(readOrderMeta({ status: "sold" })).toBeNull();
    expect(readOrderMeta("95")).toBeNull();
  });
});

describe("tarif ko'rinishi — ROL bo'yicha", () => {
  it("superadmin / admin / manager — tariflar va ulushlar", () => {
    for (const role of ["superadmin", "admin", "manager"]) {
      expect(visibleTariffs(role), role).toEqual(["marketTariff", "courierTariff", "courierShare", "branchShare"]);
    }
  });

  it("market — faqat market tarifi; kuryer — faqat kuryer tarifi", () => {
    expect(visibleTariffs("market")).toEqual(["marketTariff"]);
    expect(visibleTariffs("courier")).toEqual(["courierTariff"]);
  });

  it("boshqa rollar (registrator, operator, noma'lum) — hech narsa", () => {
    for (const role of ["registrator", "operator", "", null, undefined]) {
      expect(visibleTariffs(role)).toEqual([]);
    }
  });

  it("nom so'rovlari backend ruxsati bilan bir xil", () => {
    expect(["superadmin", "admin", "manager"].every(canLookupUsers)).toBe(true);
    expect(canLookupUsers("market")).toBe(false);
    expect(canLookupBranches("admin")).toBe(true);
    expect(canLookupBranches("manager")).toBe(false);
  });
});

describe("telHref", () => {
  it("bo'shliq va belgilar olib tashlanadi, `+` qoladi", () => {
    expect(telHref("+998 99 222-22-22")).toBe("tel:+998992222222");
  });
});
