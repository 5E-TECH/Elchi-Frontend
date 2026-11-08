import { describe, expect, it } from "vitest";
import { buildCorrectionTarget, correctionFooterState, deriveCorrectionShape } from "./target";

/**
 * T6 N2 — tuzatiladigan to'lov va uning shakli `correctable.transfer` dan (ega qarori 2026-11-03 C2); `transfer`
 * yo'q — umumiy (nom o'ylab topilmaydi); tafsilot pastki qismi holati (faqat superadmin; ALREADY_CORRECTED — hech narsa,
 * COURIER_MOVED — qulf).
 */

const transfer = (overrides: Record<string, unknown> = {}) => ({
  kind: "courier_payment",
  payment_method: "cash",
  amount: 1850000,
  receiver: { cashbox_type: "main", branch_id: null, name: null },
  courier: { id: "301", name: "Jasur Tursunov" },
  market: null,
  ...overrides,
});

const target = (correctable: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  buildCorrectionTarget({
    id: "4512",
    amount: -1850000,
    title: "Kuryer to'lovi",
    createdAt: "2026-10-07T09:32:00.000Z",
    paymentMethod: "cash",
    correctable,
    ...extra,
  })!;

describe("buildCorrectionTarget", () => {
  it("raqamli ID, musbat summa, normalizatsiya qilingan `correctable`", () => {
    const value = target({ allowed: true, deadline: "2026-11-07T09:32:00.000Z", window_days: 30, root_history_id: "4512" });
    expect(value).toMatchObject({
      id: "4512",
      amount: 1850000,
      title: "Kuryer to'lovi",
      paymentMethod: "cash",
      correctable: { allowed: true, window_days: 30, transfer: null },
    });
  });

  it("virtual qator (ID raqam emas) yoki `correctable` yo'q — `null`", () => {
    expect(buildCorrectionTarget({ id: "pending-branch-to-hq-5", amount: 1, title: "", correctable: { allowed: true } })).toBeNull();
    expect(buildCorrectionTarget({ id: null, amount: 1, title: "", correctable: { allowed: true } })).toBeNull();
    expect(buildCorrectionTarget({ id: 4512, amount: 1, title: "", correctable: null })).toBeNull();
  });
});

describe("deriveCorrectionShape", () => {
  it("kuryer → MAIN", () => {
    expect(deriveCorrectionShape(target({ allowed: true, transfer: transfer() }))).toEqual({
      kind: "courier",
      receiver: "main",
      method: "cash",
      amount: 1850000,
      courier: { id: "301", name: "Jasur Tursunov" },
      market: null,
      branch: null,
    });
  });

  it("kuryer → filial: filial ID va nomi", () => {
    const shape = deriveCorrectionShape(
      target({
        allowed: true,
        transfer: transfer({ receiver: { cashbox_type: "branch", branch_id: "15", name: "Urgut filiali" } }),
      }),
    );
    expect(shape).toMatchObject({ kind: "courier", receiver: "branch", branch: { id: "15", name: "Urgut filiali" } });
  });

  it("marketga to'lov va click_to_market (kuryer to'lovi turida, usul bo'yicha)", () => {
    const market = deriveCorrectionShape(
      target({
        allowed: true,
        transfer: transfer({ kind: "market_payment", payment_method: "click", amount: 2400000, courier: null, market: { id: "77", name: "Baraka Shop" } }),
      }),
    );
    expect(market).toMatchObject({ kind: "market", receiver: "main", method: "click", amount: 2400000, market: { name: "Baraka Shop" } });

    const clickToMarket = deriveCorrectionShape(
      target({
        allowed: true,
        transfer: transfer({ payment_method: "click_to_market", market: { id: "77", name: "Baraka Shop" } }),
      }),
    );
    expect(clickToMarket).toMatchObject({ kind: "clickToMarket", method: "click_to_market", courier: { name: "Jasur Tursunov" } });
  });

  it("`transfer` yo'q (eski backend) — umumiy: tur/qabul qiluvchi/nomlar yo'q, summa va usul oyoqdan", () => {
    expect(deriveCorrectionShape(target({ allowed: true }))).toEqual({
      kind: null,
      receiver: null,
      method: "cash",
      amount: 1850000,
      courier: null,
      market: null,
      branch: null,
    });
    expect(deriveCorrectionShape(target({ allowed: true }, { paymentMethod: "payme" })).method).toBeNull();
  });

  it("`transfer.amount` bo'lmasa — oyoq summasi; usul noma'lum bo'lsa — oyoq usuli", () => {
    const shape = deriveCorrectionShape(target({ allowed: true, transfer: transfer({ amount: null, payment_method: null }) }));
    expect(shape).toMatchObject({ amount: 1850000, method: "cash" });
  });
});

describe("correctionFooterState", () => {
  const allowed = { allowed: true, deadline: "2026-11-07T09:32:00.000Z", window_days: 30, root_history_id: "4512" };

  it("superadmin, ruxsat: tugmalar + muddat; zanjir davomi (`root_history_id ≠ id`)", () => {
    expect(correctionFooterState(true, allowed, "4512")).toEqual({
      kind: "actions",
      deadline: "2026-11-07T09:32:00.000Z",
      windowDays: 30,
      rootHistoryId: "4512",
      chained: false,
    });
    expect(correctionFooterState(true, { ...allowed, root_history_id: "4498" }, "4522")).toMatchObject({
      kind: "actions",
      chained: true,
      rootHistoryId: "4498",
    });
  });

  it("superadmin emas (admin — tasodifiy `correctable` bilan ham) — hech narsa (ega qarori 4)", () => {
    expect(correctionFooterState(false, allowed, "4512")).toEqual({ kind: "none" });
  });

  it("`correctable` yo'q / `null`, ALREADY_CORRECTED — hech narsa; COURIER_MOVED, WINDOW_EXPIRED, LEGACY, NOT_CORRECTABLE — qulf", () => {
    expect(correctionFooterState(true, null, "4512")).toEqual({ kind: "none" });
    expect(correctionFooterState(true, undefined, "4512")).toEqual({ kind: "none" });
    expect(correctionFooterState(true, { allowed: false, code: "ALREADY_CORRECTED", window_days: 30 }, "4512")).toEqual({
      kind: "none",
    });
    for (const code of ["COURIER_MOVED", "WINDOW_EXPIRED", "LEGACY_UNLINKED", "NOT_CORRECTABLE"]) {
      const state = correctionFooterState(true, { allowed: false, code, window_days: 30 }, "4512");
      expect(state.kind, code).toBe("lock");
      expect(state.kind === "lock" && state.correctable.code).toBe(code);
    }
  });
});
