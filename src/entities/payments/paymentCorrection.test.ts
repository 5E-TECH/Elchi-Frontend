import { describe, expect, it } from "vitest";
import {
  compareHistoryIdDesc,
  correctionBadgeKindOf,
  historyRowDate,
  isPaymentReversalRow,
  paymentCorrectionBadgeKind,
  toPaymentCorrectable,
  toPaymentCorrectableTransfer,
  toPaymentCorrection,
} from "./paymentCorrection";

/**
 * T6-FE-1 (XXyAZ9ge) — `correction` kontrakti (backend dev c93afc4, `payment-correction.rules.ts` 364-391, 575-593):
 * normalizator himoyaviy, belgi turi faqat `role` + `action` dan, «Tuzatilgan» vaqti — tuzatish vaqti (C1).
 */

const raw = {
  id: "12",
  action: "edit",
  payment_kind: "market_payment",
  role: "original",
  reason: "  Marketga 2 000 000 so'm o'tkazilgan, summa xato kiritilgan  ",
  created_by_name: "Shodiyor Ergashev",
  created_at: "2026-10-08T10:10:00.000Z",
  original_amount: "2400000",
  new_amount: 2_000_000,
  related_history_id: "4521",
  related: {
    id: "4522",
    source_type: "market_payment",
    role: "replacement",
    operation_type: "expense",
    amount: "2000000",
    created_at: "2026-10-08T10:10:00.000Z",
  },
};

describe("toPaymentCorrection", () => {
  it("to'liq obyekt: son satrlari son, sabab trim, related tekshirilgan", () => {
    expect(toPaymentCorrection(raw)).toEqual({
      id: "12",
      action: "edit",
      payment_kind: "market_payment",
      role: "original",
      reason: "Marketga 2 000 000 so'm o'tkazilgan, summa xato kiritilgan",
      created_by_name: "Shodiyor Ergashev",
      created_at: "2026-10-08T10:10:00.000Z",
      original_amount: 2_400_000,
      new_amount: 2_000_000,
      related_history_id: "4521",
      related: {
        id: "4522",
        source_type: "market_payment",
        role: "replacement",
        operation_type: "expense",
        amount: 2_000_000,
        created_at: "2026-10-08T10:10:00.000Z",
      },
    });
  });

  it("obyekt emas yoki noma'lum role / action — null", () => {
    expect(toPaymentCorrection(null)).toBeNull();
    expect(toPaymentCorrection(undefined)).toBeNull();
    expect(toPaymentCorrection("original")).toBeNull();
    expect(toPaymentCorrection([raw])).toBeNull();
    expect(toPaymentCorrection({ ...raw, role: "partial" })).toBeNull();
    expect(toPaymentCorrection({ ...raw, action: "cancel" })).toBeNull();
    expect(toPaymentCorrection({ ...raw, role: undefined })).toBeNull();
  });

  it("yaroqsiz related — null, qolgani saqlanadi; ism yo'q — null; reverse — new_amount null", () => {
    const value = toPaymentCorrection({
      ...raw,
      action: "reverse",
      new_amount: null,
      created_by_name: null,
      related: { id: "", role: "reversal" },
    });
    expect(value?.related).toBeNull();
    expect(value?.created_by_name).toBeNull();
    expect(value?.new_amount).toBeNull();
    expect(toPaymentCorrection({ ...raw, related: { id: "1", role: "x" } })?.related).toBeNull();
    expect(toPaymentCorrection({ ...raw, related: { ...raw.related, operation_type: "?" } })?.related?.operation_type).toBeNull();
  });
});

describe("belgi turi", () => {
  it("role + action → Qaytarildi / Tahrirlangan / Teskari yozuv / Tuzatilgan", () => {
    expect(correctionBadgeKindOf("original", "reverse")).toBe("reversed");
    expect(correctionBadgeKindOf("original", "edit")).toBe("edited");
    // Tahrir ham teskari yozuv yozadi — action qanday bo'lmasin «Teskari yozuv».
    expect(correctionBadgeKindOf("reversal", "edit")).toBe("reversal");
    expect(correctionBadgeKindOf("reversal", "reverse")).toBe("reversal");
    expect(correctionBadgeKindOf("replacement", "edit")).toBe("replacement");
  });

  it("qatordan: correction bo'yicha; correction yo'q teskari yozuv — manba turidan; oddiy qator — null", () => {
    expect(paymentCorrectionBadgeKind({ correction: raw })).toBe("edited");
    expect(paymentCorrectionBadgeKind({ correction: null, source_type: "payment_reversal" })).toBe("reversal");
    expect(paymentCorrectionBadgeKind({ correction: null, source_type: "courier_payment" })).toBeNull();
    expect(paymentCorrectionBadgeKind({ source_type: "sell" })).toBeNull();
    expect(paymentCorrectionBadgeKind(null)).toBeNull();
  });

  it("teskari yozuv qatori: manba turi, reverses_history_id yoki role=reversal", () => {
    expect(isPaymentReversalRow({ source_type: "payment_reversal" })).toBe(true);
    expect(isPaymentReversalRow({ reverses_history_id: "4512" })).toBe(true);
    expect(isPaymentReversalRow({ correction: { role: "reversal" } })).toBe(true);
    expect(isPaymentReversalRow({ source_type: "courier_payment", reverses_history_id: null, correction: raw })).toBe(false);
  });
});

describe("historyRowDate (C1)", () => {
  const paid = "2026-10-08T08:05:00.000Z";
  const corrected = "2026-10-08T10:10:00.000Z";

  it("«Tuzatilgan» — tuzatish vaqti (backend asl payment_date ni nusxalaydi)", () => {
    expect(historyRowDate({ correction: { role: "replacement" }, payment_date: paid, createdAt: corrected })).toBe(corrected);
    expect(historyRowDate({ correction: { role: "replacement" }, payment_date: paid, created_at: corrected })).toBe(corrected);
  });

  it("qolganlari — payment_date, bo'lmasa createdAt; createdAt yo'q «Tuzatilgan» — payment_date", () => {
    expect(historyRowDate({ correction: { role: "original" }, payment_date: paid, createdAt: corrected })).toBe(paid);
    expect(historyRowDate({ correction: { role: "reversal" }, payment_date: null, createdAt: corrected })).toBe(corrected);
    expect(historyRowDate({ payment_date: paid })).toBe(paid);
    expect(historyRowDate({ correction: { role: "replacement" }, payment_date: paid })).toBe(paid);
    expect(historyRowDate({})).toBe("");
    expect(historyRowDate(null)).toBe("");
  });
});

describe("compareHistoryIdDesc (teng vaqtda ID bo'yicha)", () => {
  it("katta (yangi) bigint ID oldin; uzunligi har xil — son bo'yicha, satr emas", () => {
    expect(compareHistoryIdDesc("4522", "4521")).toBeLessThan(0);
    expect(compareHistoryIdDesc("4521", "4522")).toBeGreaterThan(0);
    expect(compareHistoryIdDesc("10000", "9999")).toBeLessThan(0);
    expect(compareHistoryIdDesc(4522, "4522")).toBe(0);
    expect(compareHistoryIdDesc("9007199254740993", "9007199254740992")).toBeLessThan(0);
  });

  it("raqamli bo'lmagan ID — 0 (tartib saqlanadi)", () => {
    expect(compareHistoryIdDesc("pending-4498", "4498")).toBe(0);
    expect(compareHistoryIdDesc(undefined, "4498")).toBe(0);
    expect(compareHistoryIdDesc(null, null)).toBe(0);
  });

  it("teskari yozuv va yangi to'lov bir xil vaqtda: «Tuzatilgan» tepada", () => {
    const at = "2026-10-08T10:10:00.000Z";
    const rows = [
      { id: "4521", correction: { role: "reversal" }, payment_date: null, createdAt: at },
      { id: "4522", correction: { role: "replacement" }, payment_date: "2026-10-08T08:05:00.000Z", createdAt: at },
    ];
    const sorted = [...rows].sort(
      (left, right) =>
        Date.parse(historyRowDate(right)) - Date.parse(historyRowDate(left)) || compareHistoryIdDesc(left.id, right.id),
    );
    expect(sorted.map((row) => row.id)).toEqual(["4522", "4521"]);
  });
});

/**
 * T6 N2 — `correctable` (faqat superadmin tafsilotida) va `correctable.transfer` (backend #623 mUhkJHmi, ega qarori
 * 2026-11-03 C2): MAIN da filial ID/nomi `null`; noma'lum shakl — `transfer: null` (umumiy matn, nom o'ylab topilmaydi).
 */
describe("toPaymentCorrectableTransfer", () => {
  it("kuryer to'lovi → filial: kuryer va filial nomi; market `null`", () => {
    expect(
      toPaymentCorrectableTransfer({
        kind: "courier_payment",
        payment_method: "cash",
        amount: "1850000",
        receiver: { cashbox_type: "branch", branch_id: 15, name: "Urgut filiali" },
        courier: { id: "301", name: "Jasur Tursunov" },
        market: null,
      }),
    ).toEqual({
      kind: "courier_payment",
      payment_method: "cash",
      amount: 1850000,
      receiver: { cashbox_type: "branch", branch_id: "15", name: "Urgut filiali" },
      courier: { id: "301", name: "Jasur Tursunov" },
      market: null,
    });
  });

  it("MAIN: `branch_id` / `name` kelsa ham `null`; nom `null` — saqlanadi (fail-open); noma'lum usul — `null`", () => {
    expect(
      toPaymentCorrectableTransfer({
        kind: "market_payment",
        payment_method: "payme",
        amount: 2400000,
        receiver: { cashbox_type: "main", branch_id: "1", name: "HQ" },
        courier: null,
        market: { id: "77", name: null },
      }),
    ).toEqual({
      kind: "market_payment",
      payment_method: null,
      amount: 2400000,
      receiver: { cashbox_type: "main", branch_id: null, name: null },
      courier: null,
      market: { id: "77", name: null },
    });
  });

  it("yaroqsiz: obyekt emas, noma'lum tur yoki qabul qiluvchi — `null`", () => {
    expect(toPaymentCorrectableTransfer(null)).toBeNull();
    expect(toPaymentCorrectableTransfer("x")).toBeNull();
    expect(toPaymentCorrectableTransfer({ kind: "sell", receiver: { cashbox_type: "main" } })).toBeNull();
    expect(toPaymentCorrectableTransfer({ kind: "courier_payment", receiver: { cashbox_type: "couriers" } })).toBeNull();
    expect(toPaymentCorrectableTransfer({ kind: "courier_payment" })).toBeNull();
  });
});

describe("toPaymentCorrectable", () => {
  it("ruxsat: muddat, oyna, zanjir boshi, `transfer`", () => {
    const value = toPaymentCorrectable({
      allowed: true,
      deadline: "2026-11-07T09:32:00.000Z",
      window_days: 30,
      root_history_id: 4512,
      transfer: {
        kind: "courier_payment",
        payment_method: "click_to_market",
        amount: 1200000,
        receiver: { cashbox_type: "main", branch_id: null, name: null },
        courier: { id: "302", name: "Rustam Qosimov" },
        market: { id: "77", name: "Baraka Shop" },
      },
    });
    expect(value).toMatchObject({
      allowed: true,
      deadline: "2026-11-07T09:32:00.000Z",
      window_days: 30,
      root_history_id: "4512",
      transfer: { kind: "courier_payment", payment_method: "click_to_market", market: { name: "Baraka Shop" } },
    });
    expect(value).not.toHaveProperty("code");
  });

  it("qulf: ma'lum kod va sabab; noma'lum kod/sabab tashlanadi; `allowed` faqat aniq `true`", () => {
    expect(toPaymentCorrectable({ allowed: false, code: "COURIER_MOVED", deadline: null, window_days: 10 })).toEqual({
      allowed: false,
      code: "COURIER_MOVED",
      deadline: null,
      window_days: 10,
      root_history_id: null,
      transfer: null,
    });
    const reversal = toPaymentCorrectable({ allowed: false, code: "NOT_CORRECTABLE", reason: "reversal_row" });
    expect(reversal).toMatchObject({ code: "NOT_CORRECTABLE", reason: "reversal_row", transfer: null });
    const odd = toPaymentCorrectable({ allowed: "true", code: "SOMETHING", reason: "other", window_days: 0 });
    expect(odd).toEqual({ allowed: false, deadline: null, window_days: 30, root_history_id: null, transfer: null });
  });

  it("`null` / obyekt emas — `null` (tugma ham, izoh ham yo'q); eski backend (`transfer` kaliti yo'q) — `transfer: null`", () => {
    expect(toPaymentCorrectable(null)).toBeNull();
    expect(toPaymentCorrectable(undefined)).toBeNull();
    expect(toPaymentCorrectable([])).toBeNull();
    expect(toPaymentCorrectable({ allowed: true, deadline: "2026-11-07T09:32:00.000Z", window_days: 30 })?.transfer).toBeNull();
  });
});
