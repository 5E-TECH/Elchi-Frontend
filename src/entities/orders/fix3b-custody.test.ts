import { describe, expect, it } from "vitest";
import { canCourierRestoreCancelledOrder, isCourierHeldOrder } from "./custody";
import { getRollbackWarning } from "./rollbackResult";

/**
 * fix3b LC-04 / LC-05 / L1 CODE-14 — backend qo'riqlarining FE nusxasi.
 */
describe("isCourierHeldOrder (LC-04, backend isHeldByCourier)", () => {
  it("holder COURIER yoki courier_id / holder_courier_id bo'lsa — kuryerda", () => {
    expect(isCourierHeldOrder({ holder_type: "COURIER" })).toBe(true);
    expect(isCourierHeldOrder({ holder_type: "courier" })).toBe(true);
    expect(isCourierHeldOrder({ holder_type: "BRANCH", courier_id: "289" })).toBe(true);
    expect(isCourierHeldOrder({ holder_type: "BRANCH", holder_courier_id: 289 })).toBe(true);
    expect(isCourierHeldOrder({ holderType: "COURIER" })).toBe(true);
  });

  it("filial/HQ qo'lida, kuryersiz — kuryerda emas; '0' sentinel kuryer emas", () => {
    expect(isCourierHeldOrder({ holder_type: "BRANCH", courier_id: null, holder_courier_id: null })).toBe(false);
    expect(isCourierHeldOrder({ holder_type: "HQ" })).toBe(false);
    expect(isCourierHeldOrder({ holder_type: "BRANCH", courier_id: "0", holder_courier_id: " 0 " })).toBe(false);
    expect(isCourierHeldOrder({})).toBe(false);
    expect(isCourierHeldOrder(null)).toBe(false);
  });
});

describe("canCourierRestoreCancelledOrder (LC-05)", () => {
  const own = { status: "cancelled", holder_type: "COURIER", holder_courier_id: "56" };

  it("posilka shu kuryerda — tiklash mumkin", () => {
    expect(canCourierRestoreCancelledOrder(own, "56")).toBe(true);
    expect(canCourierRestoreCancelledOrder({ ...own, holder_courier_id: 56 }, 56)).toBe(true);
  });

  it("filial/HQ qabul qilgan yoki boshqa kuryerda — tiklab bo'lmaydi", () => {
    expect(canCourierRestoreCancelledOrder({ ...own, holder_type: "BRANCH", holder_courier_id: null }, "56")).toBe(false);
    expect(canCourierRestoreCancelledOrder({ ...own, holder_type: "HQ", holder_courier_id: null }, "56")).toBe(false);
    expect(canCourierRestoreCancelledOrder({ ...own, holder_courier_id: "57" }, "56")).toBe(false);
    expect(canCourierRestoreCancelledOrder({ ...own, holder_courier_id: "0" }, "0")).toBe(false);
  });

  it("pochtaga yuborilgan (cancelled (sent)) bekor buyurtma — tiklab bo'lmaydi", () => {
    expect(canCourierRestoreCancelledOrder({ ...own, transport_status: "cancelled (sent)" }, "56")).toBe(false);
    expect(canCourierRestoreCancelledOrder({ ...own, status: "cancelled (sent)" }, "56")).toBe(false);
  });

  it("joriy foydalanuvchi noma'lum yoki holat bekor emas — yo'q", () => {
    expect(canCourierRestoreCancelledOrder(own, null)).toBe(false);
    expect(canCourierRestoreCancelledOrder({ ...own, status: "waiting" }, "56")).toBe(false);
  });

  it("eski yozuvda holder_type bo'sh bo'lsa backend kabi holder_courier_id hal qiladi", () => {
    expect(canCourierRestoreCancelledOrder({ status: "cancelled", holder_courier_id: "56" }, "56")).toBe(true);
  });
});

describe("getRollbackWarning (L1 CODE-14)", () => {
  const fallback = "Pochtaga qo'lda qo'shing";

  it("cancel_post_created=false — backend ogohlantirishi", () => {
    expect(
      getRollbackWarning(
        { statusCode: 200, message: "msg", data: { cancel_post_created: false, warning: "Pochtaga qo'shilmadi (403)" } },
        fallback,
      ),
    ).toBe("Pochtaga qo'shilmadi (403)");
    expect(getRollbackWarning({ message: "Faqat xabar", data: { cancel_post_created: false } }, fallback)).toBe(
      "Faqat xabar",
    );
    expect(getRollbackWarning({ data: { cancel_post_created: false } }, fallback)).toBe(fallback);
  });

  it("oddiy muvaffaqiyat — ogohlantirish yo'q", () => {
    expect(getRollbackWarning({ statusCode: 200, message: "Order WAITING holatiga qaytarildi", data: {} }, fallback)).toBeNull();
    expect(getRollbackWarning({ data: { cancel_post_created: true } }, fallback)).toBeNull();
    expect(getRollbackWarning(undefined, fallback)).toBeNull();
  });
});
