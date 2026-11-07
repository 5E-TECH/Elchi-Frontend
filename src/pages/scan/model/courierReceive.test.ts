import { describe, expect, it } from "vitest";
import {
  getBranchReceiveDecision,
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

describe("getBranchReceiveDecision — menejer «Pochtadan qabul» (o'tkazma pochtasi)", () => {
  const BRANCH = "3";
  /** HQ → filial o'tkazma pochtasidagi buyurtma: kuryersiz, `branch_id` — manzil filial. */
  const transfer = (patch: Record<string, unknown> = {}) => ({
    status: "on the road",
    courier_id: null,
    holder_courier_id: null,
    branch_id: BRANCH,
    post_id: "48",
    ...patch,
  });

  it("o'z filialiga kelgan yo'ldagi (yoki mijoz kutilmoqda) buyurtma — darhol qabul", () => {
    expect(getBranchReceiveDecision(transfer(), BRANCH)).toBe("receive");
    expect(getBranchReceiveDecision(transfer({ status: "ON_THE_ROAD" }), BRANCH)).toBe("receive");
    expect(getBranchReceiveDecision(transfer({ status: "waiting_customer" }), BRANCH)).toBe("receive");
    expect(getBranchReceiveDecision(transfer({ branch_id: 3 }), 3)).toBe("receive");
  });

  it("qabul qilingan («kutilmoqda») — natija sahifasi (sotish / bekor)", () => {
    expect(getBranchReceiveDecision(transfer({ status: "waiting" }), BRANCH)).toBe("open");
  });

  it("kuryerdagi buyurtma (courier_id yoki holder_courier_id): yo'lda yoki «kutilmoqda» — kuryerniki", () => {
    expect(getBranchReceiveDecision(transfer({ courier_id: "15" }), BRANCH)).toBe("other");
    expect(getBranchReceiveDecision(transfer({ holder_courier_id: "15" }), BRANCH)).toBe("other");
    expect(getBranchReceiveDecision(transfer({ courier_id: "15", status: "waiting" }), BRANCH)).toBe("other");
    // '0' — tayinlanmagan pochta sentineli, kuryer emas.
    expect(getBranchReceiveDecision(transfer({ courier_id: "0" }), BRANCH)).toBe("receive");
  });

  it("sotilgan / bekor qilingan (kuryer id'si qolgan bo'lsa ham) — «yo'lda emas», kuryerniki deyilmaydi", () => {
    for (const status of ["sold", "partly_paid", "paid", "cancelled", "cancelled (sent)", "closed", "returned_to_market"]) {
      expect(getBranchReceiveDecision(transfer({ courier_id: "15", status }), BRANCH)).toBe("notReceivable");
    }
    expect(getBranchReceiveDecision(transfer({ courier_id: "15", status: "new" }), BRANCH)).toBe("notReceivable");
  });

  it("filiallararo paketdagi posilka (pochtasiz, `branch_id` — jo'natgan filial) — «pochtada emas», begona deyilmaydi", () => {
    expect(
      getBranchReceiveDecision(transfer({ post_id: null, branch_id: "11", current_batch_id: "b-5" }), BRANCH),
    ).toBe("notReceivable");
  });

  it("boshqa filialniki — qabul qilinmaydi; filial noma'lum bo'lsa backend hal qiladi", () => {
    expect(getBranchReceiveDecision(transfer({ branch_id: "7" }), BRANCH)).toBe("notOurs");
    expect(getBranchReceiveDecision(transfer({ branch_id: "7" }), "")).toBe("receive");
    expect(getBranchReceiveDecision(transfer({ branch_id: "7" }), null)).toBe("receive");
    expect(getBranchReceiveDecision(transfer({ branch_id: null }), BRANCH)).toBe("receive");
  });

  it("pochtasiz yoki boshqa holatda — qabul qilib bo'lmaydi", () => {
    expect(getBranchReceiveDecision(transfer({ post_id: null }), BRANCH)).toBe("notReceivable");
    expect(getBranchReceiveDecision(transfer({ post_id: "0" }), BRANCH)).toBe("notReceivable");
    for (const status of ["new", "received", "sold", "cancelled", "paid", "closed", "returned_to_market"]) {
      expect(getBranchReceiveDecision(transfer({ status }), BRANCH)).toBe("notReceivable");
    }
    expect(getBranchReceiveDecision(null, BRANCH)).toBe("notReceivable");
  });
});
