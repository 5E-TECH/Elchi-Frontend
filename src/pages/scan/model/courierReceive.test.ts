import { describe, expect, it } from "vitest";
import {
  getCourierReceiveDecision,
  getCourierScanAction,
  isCourierReceivableStatus,
  isOwnCourierOrder,
  readOrderPostId,
  readScanReceiveResult,
} from "./courierReceive";

const ME = "56";
const order = (patch: Record<string, unknown> = {}) => ({
  status: "on_the_road",
  courier_id: ME,
  post_id: "p-7",
  ...patch,
});

describe("courierReceive — kuryer skan-qabuli qoidalari", () => {
  it("qabul qilinadigan holat: yo'lda yoki mijoz kutilmoqda (enum yoki matn ko'rinishida)", () => {
    expect(isCourierReceivableStatus("on_the_road")).toBe(true);
    expect(isCourierReceivableStatus("ON_THE_ROAD")).toBe(true);
    expect(isCourierReceivableStatus("on the road")).toBe(true);
    expect(isCourierReceivableStatus("waiting_customer")).toBe(true);
    expect(isCourierReceivableStatus("waiting")).toBe(false);
    expect(isCourierReceivableStatus("sold")).toBe(false);
    expect(isCourierReceivableStatus(undefined)).toBe(false);
  });

  it("pochta id: bo'sh va '0' (tayinlanmagan pochta sentineli) — yo'q", () => {
    expect(readOrderPostId(order())).toBe("p-7");
    expect(readOrderPostId(order({ post_id: 42 }))).toBe("42");
    expect(readOrderPostId(order({ post_id: "0" }))).toBeNull();
    expect(readOrderPostId(order({ post_id: "" }))).toBeNull();
    expect(readOrderPostId(order({ post_id: null }))).toBeNull();
    expect(readOrderPostId(null)).toBeNull();
  });

  it("o'ziniki: courier_id yoki holder_courier_id men, boshqasi boshqa kuryer emas", () => {
    expect(isOwnCourierOrder(order(), ME)).toBe(true);
    expect(isOwnCourierOrder(order({ courier_id: null, holder_courier_id: ME }), ME)).toBe(true);
    expect(isOwnCourierOrder(order({ holder_courier_id: "77" }), ME)).toBe(false);
    expect(isOwnCourierOrder(order({ courier_id: "77" }), ME)).toBe(false);
    expect(isOwnCourierOrder(order({ courier_id: null }), ME)).toBe(false);
    expect(isOwnCourierOrder(order({ courier_id: "0" }), ME)).toBe(false);
    expect(isOwnCourierOrder(order(), null)).toBe(false);
  });

  it("natija sahifasi amali: yo'lda → qabul, kutilmoqda → sotish, qolgani → «O'zimga olish»", () => {
    expect(getCourierScanAction(order(), ME)).toBe("receive");
    expect(getCourierScanAction(order({ status: "waiting_customer" }), ME)).toBe("receive");
    expect(getCourierScanAction(order({ status: "waiting" }), ME)).toBe("sell");
    // Pochtasi yo'q yo'ldagi buyurtma — avvalgidek («allaqachon sizda»).
    expect(getCourierScanAction(order({ post_id: null }), ME)).toBe("take");
    expect(getCourierScanAction(order({ status: "sold" }), ME)).toBe("take");
    // Bo'sh yoki boshqa kuryerniki — avvalgi «O'zimga olish» oqimi.
    expect(getCourierScanAction(order({ courier_id: null, status: "new" }), ME)).toBe("take");
    expect(getCourierScanAction(order({ courier_id: "77" }), ME)).toBe("take");
    expect(getCourierScanAction(order({ status: "waiting", holder_courier_id: "77" }), ME)).toBe("take");
  });

  it("«Qabul qilish» rejimi qarori", () => {
    expect(getCourierReceiveDecision(order(), ME)).toBe("receive");
    expect(getCourierReceiveDecision(order({ status: "waiting_customer" }), ME)).toBe("receive");
    expect(getCourierReceiveDecision(order({ status: "waiting" }), ME)).toBe("open");
    expect(getCourierReceiveDecision(order({ courier_id: null, status: "new" }), ME)).toBe("free");
    // Hech kimda emas, lekin sotilgan / bekor / yopilgan — «O'zimga olish» ham ololmaydi: sababi aytiladi.
    expect(getCourierReceiveDecision(order({ courier_id: null, status: "sold" }), ME)).toBe("notReceivable");
    expect(getCourierReceiveDecision(order({ courier_id: null, status: "cancelled" }), ME)).toBe("notReceivable");
    expect(getCourierReceiveDecision(order({ courier_id: null, status: "returned_to_market" }), ME)).toBe("notReceivable");
    expect(getCourierReceiveDecision(order({ courier_id: "0", status: "received" }), ME)).toBe("free");
    expect(getCourierReceiveDecision(order({ status: "new" }), ME)).toBe("free");
    expect(getCourierReceiveDecision(order({ courier_id: "77" }), ME)).toBe("other");
    expect(getCourierReceiveDecision(order({ holder_courier_id: "77" }), ME)).toBe("other");
    expect(getCourierReceiveDecision(order({ post_id: null }), ME)).toBe("notReceivable");
    expect(getCourierReceiveDecision(order({ status: "sold" }), ME)).toBe("notReceivable");
    expect(getCourierReceiveDecision(order({ status: "cancelled" }), ME)).toBe("notReceivable");
  });

  it("qabul javobi: yangi shakl (received / already / failures) va eski shakl (faqat not_received)", () => {
    expect(readScanReceiveResult({ received_order_ids: ["9"], not_received_order_ids: [] }, "9")).toEqual({
      ok: true,
      already: false,
      error: null,
    });
    expect(readScanReceiveResult({ already_received_order_ids: [9], not_received_order_ids: [] }, "9")).toEqual({
      ok: true,
      already: true,
      error: null,
    });
    expect(
      readScanReceiveResult(
        {
          received_order_ids: [],
          not_received_order_ids: ["9"],
          failures: [{ order_id: "9", error: "Buyurtma yo'lda emas" }],
        },
        "9",
      ),
    ).toEqual({ ok: false, already: false, error: "Buyurtma yo'lda emas" });
    expect(readScanReceiveResult({ not_received_order_ids: ["9"] }, "9")).toEqual({
      ok: false,
      already: false,
      error: null,
    });
    // Eski shakl: id «qabul qilinmadi» ro'yxatida bo'lmasa — qabul qilingan.
    expect(readScanReceiveResult({ data: { not_received_order_ids: ["8"] } }, "9").ok).toBe(true);
    expect(readScanReceiveResult({ data: { not_received_order_ids: ["9"] } }, "9").ok).toBe(false);
    expect(readScanReceiveResult(undefined, "9").ok).toBe(true);
  });
});
