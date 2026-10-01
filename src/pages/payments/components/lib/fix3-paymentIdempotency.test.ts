import { describe, expect, it, beforeEach } from "vitest";
import {
  branchToMainPaymentFingerprint,
  courierPaymentFingerprint,
  isIdempotentReplay,
  isUncertainPaymentError,
  marketPaymentFingerprint,
  settlePaymentKey,
  takePaymentKey,
} from "./paymentIdempotency";

describe("payment idempotency keys (C1 / FE-PAY-03)", () => {
  beforeEach(() => sessionStorage.clear());

  it("returns the same key for the same pending payment until it is settled", () => {
    const fingerprint = marketPaymentFingerprint({ market_id: "201", amount: 5_000_000, payment_method: "cash" });

    const first = takePaymentKey(fingerprint);
    expect(first).toEqual(expect.any(String));
    expect(first).not.toBe("");
    expect(takePaymentKey(fingerprint)).toBe(first);

    settlePaymentKey(fingerprint);
    expect(takePaymentKey(fingerprint)).not.toBe(first);
  });

  it("keeps every pending payment's own key (A pending → B → A again reuses A's key)", () => {
    const a = branchToMainPaymentFingerprint({ branch_id: "16", amount: 100_000, payment_method: "cash" });
    const b = branchToMainPaymentFingerprint({ branch_id: "16", amount: 50_000, payment_method: "cash" });

    const keyA = takePaymentKey(a);
    const keyB = takePaymentKey(b);
    expect(keyB).not.toBe(keyA);
    expect(takePaymentKey(a)).toBe(keyA);

    settlePaymentKey(b);
    expect(takePaymentKey(a)).toBe(keyA);
  });

  it("persists pending keys in sessionStorage (survives a reload) under the existing storage name", () => {
    const fingerprint = marketPaymentFingerprint({ market_id: "201", amount: 1000, payment_method: "click" });
    const key = takePaymentKey(fingerprint);

    const stored = JSON.parse(sessionStorage.getItem("elchi:pending-courier-payment-keys") ?? "{}");
    expect(stored[fingerprint]).toBe(key);
  });

  it("never mixes courier, market and branch fingerprints with the same id, amount and method", () => {
    const fingerprints = new Set([
      courierPaymentFingerprint({ courier_id: "15", amount: 1000, payment_method: "cash", market_id: null }),
      marketPaymentFingerprint({ market_id: "15", amount: 1000, payment_method: "cash" }),
      branchToMainPaymentFingerprint({ branch_id: "15", amount: 1000, payment_method: "cash" }),
    ]);

    expect(fingerprints.size).toBe(3);
  });

  it("keeps the courier fingerprint format unchanged (pending courier keys stay valid after deploy)", () => {
    expect(
      courierPaymentFingerprint({ courier_id: "263", amount: 100000, payment_method: "cash", market_id: null }),
    ).toBe('["263",100000,"cash",null]');
  });

  it("changes the fingerprint when amount or method changes (a different payment)", () => {
    const base = marketPaymentFingerprint({ market_id: "201", amount: 1000, payment_method: "cash" });

    expect(marketPaymentFingerprint({ market_id: "201", amount: 2000, payment_method: "cash" })).not.toBe(base);
    expect(marketPaymentFingerprint({ market_id: "201", amount: 1000, payment_method: "click" })).not.toBe(base);
    expect(marketPaymentFingerprint({ market_id: "202", amount: 1000, payment_method: "cash" })).not.toBe(base);
  });
});

describe("isIdempotentReplay", () => {
  it("recognises the finance duplicate reply only", () => {
    expect(isIdempotentReplay({ data: { data: { idempotent: true } } })).toBe(true);
    expect(isIdempotentReplay({ data: { data: {} } })).toBe(false);
    expect(isIdempotentReplay({ data: { data: null } })).toBe(false);
    expect(isIdempotentReplay(undefined)).toBe(false);
  });
});

describe("isUncertainPaymentError", () => {
  it("treats no response and 502/503/504 as an unknown outcome", () => {
    expect(isUncertainPaymentError(Object.assign(new Error("So'rov vaqti tugadi"), { code: "ECONNABORTED" }))).toBe(true);
    expect(isUncertainPaymentError({ response: { status: 504 } })).toBe(true);
    expect(isUncertainPaymentError({ response: { status: 503 } })).toBe(true);
    expect(isUncertainPaymentError({ response: { status: 502 } })).toBe(true);
  });

  it("treats a definite answer as known (no money moved)", () => {
    expect(isUncertainPaymentError({ response: { status: 400 } })).toBe(false);
    expect(isUncertainPaymentError({ response: { status: 403 } })).toBe(false);
    expect(isUncertainPaymentError({ response: { status: 500 } })).toBe(false);
    expect(isUncertainPaymentError(null)).toBe(false);
  });
});
