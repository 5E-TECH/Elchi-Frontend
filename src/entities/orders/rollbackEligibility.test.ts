import { describe, expect, it, vi } from "vitest";
import {
  getRollbackBlockReason,
  hasCancelPost,
  isCancelledSentOrder,
  readRollbackEligibility,
  resolveRollbackAvailability,
} from "./rollbackEligibility";
import { classifyRollbackError, getRollbackErrorCode, isRetryableRollbackError } from "./rollbackError";

/** BE #738 — `rollback: { allowed, code, message } | null` (ro'yxat, tafsilot, kuryer ro'yxatlari). */
describe("readRollbackEligibility", () => {
  it("to'g'ri shakl o'qiladi; matnlar qirqiladi, bo'sh matn — null", () => {
    expect(readRollbackEligibility({ rollback: { allowed: true, code: null, message: null } })).toEqual({
      allowed: true,
      code: null,
      message: null,
    });
    expect(
      readRollbackEligibility({ rollback: { allowed: false, code: " SUPERADMIN_ONLY ", message: " Faqat superadmin " } }),
    ).toEqual({ allowed: false, code: "SUPERADMIN_ONLY", message: "Faqat superadmin" });
    expect(readRollbackEligibility({ rollback: { allowed: false, code: "", message: "  " } })).toEqual({
      allowed: false,
      code: null,
      message: null,
    });
  });

  it("noma'lum — null: maydon yo'q, null, boshqa shakl", () => {
    for (const order of [
      null,
      undefined,
      "95",
      {},
      { rollback: null },
      { rollback: "allowed" },
      { rollback: [] },
      { rollback: { allowed: "true" } },
      { rollback: { code: "SUPERADMIN_ONLY" } },
    ]) {
      expect(readRollbackEligibility(order), JSON.stringify(order)).toBeNull();
    }
  });
});

describe("resolveRollbackAvailability — ko'rinish qoidasi", () => {
  it("⭐ maydon bor — faqat `allowed` (zaxira chaqirilmaydi)", () => {
    const fallback = vi.fn(() => true);
    expect(resolveRollbackAvailability({ rollback: { allowed: true, code: null, message: null } }, fallback)).toEqual({
      allowed: true,
      reason: null,
      source: "server",
    });
    expect(
      resolveRollbackAvailability(
        {
          status: "cancelled",
          rollback: { allowed: false, code: "PARCEL_NOT_IN_BRANCH", message: "Posilka filialdan jo'natilgan" },
        },
        fallback,
      ),
    ).toEqual({ allowed: false, reason: "Posilka filialdan jo'natilgan", source: "server" });
    expect(fallback).not.toHaveBeenCalled();
  });

  it("⭐ maydon noma'lum (`null` / yo'q) — sahifaning zaxira qoidasi, sababsiz", () => {
    expect(resolveRollbackAvailability({ rollback: null }, () => true)).toEqual({
      allowed: true,
      reason: null,
      source: "fallback",
    });
    expect(resolveRollbackAvailability({ status: "sold" }, () => false)).toEqual({
      allowed: false,
      reason: null,
      source: "fallback",
    });
  });

  it("«jim» kodlar (rol / holat qaytarilmaydi) — sabab ko'rsatilmaydi; boshqa rad — server matni", () => {
    expect(getRollbackBlockReason({ allowed: false, code: "NOT_ALLOWED_ROLE", message: "Faqat superadmin, menejer" })).toBeNull();
    expect(getRollbackBlockReason({ allowed: false, code: "STATUS_NOT_ROLLBACKABLE", message: "status: waiting" })).toBeNull();
    for (const code of [
      "NO_PERMISSION",
      "NOT_OWN_BRANCH",
      "NOT_OWN_ORDER",
      "PARCEL_NOT_IN_BRANCH",
      "SUPERADMIN_ONLY",
      "COURIER_REMITTED",
      "CORRECTION_REQUIRED",
      "NO_SALE_RECORD",
    ]) {
      expect(getRollbackBlockReason({ allowed: false, code, message: `sabab ${code}` }), code).toBe(`sabab ${code}`);
    }
    expect(getRollbackBlockReason({ allowed: true, code: null, message: null })).toBeNull();
    expect(getRollbackBlockReason(null)).toBeNull();
  });

  it("sabab faqat sotilgan / bekor / to'langan holatda; yopilgan va marketga qaytarilganda — yo'q", () => {
    const denied = { allowed: false, code: "PARCEL_NOT_IN_BRANCH", message: "Posilka filialda emas" };
    for (const status of ["sold", "cancelled", "canceled", "cancelled (sent)", "paid", "partly_paid"]) {
      expect(resolveRollbackAvailability({ status, rollback: denied }, () => true).reason, status).toBe(
        "Posilka filialda emas",
      );
    }
    for (const status of ["closed", "returned to market", "waiting", undefined]) {
      expect(resolveRollbackAvailability({ status, rollback: denied }, () => true), String(status)).toEqual({
        allowed: false,
        reason: null,
        source: "server",
      });
    }
  });
});

describe("zaxira qoidasi yordamchilari", () => {
  it("«Bekor — jo'natilgan»: holat yoki gateway ko'rinishi (`cancelled` + `transport_status`)", () => {
    expect(isCancelledSentOrder({ status: "cancelled (sent)" })).toBe(true);
    expect(isCancelledSentOrder({ status: "cancelled", transport_status: "cancelled (sent)" })).toBe(true);
    expect(isCancelledSentOrder({ status: "canceled", transportStatus: "canceled (sent)" })).toBe(true);
    expect(isCancelledSentOrder({ status: "cancelled" })).toBe(false);
    expect(isCancelledSentOrder({ status: "sold" })).toBe(false);
    expect(isCancelledSentOrder(null)).toBe(false);
  });

  it("bekorlar pochtasi (`canceled_post_id`)", () => {
    expect(hasCancelPost({ canceled_post_id: "41" })).toBe(true);
    expect(hasCancelPost({ canceledPostId: 41 })).toBe(true);
    for (const value of [null, undefined, "", "0", " "]) {
      expect(hasCancelPost({ canceled_post_id: value }), String(value)).toBe(false);
    }
  });
});

describe("classifyRollbackError — oynadagi xato turi", () => {
  const httpError = (status: number, data: unknown) => ({ isAxiosError: true, response: { status, data } });

  it.each([
    [httpError(400, { code: "STATE_CHANGED", message: "Rollback holati o'zgargan" }), "state_changed"],
    [httpError(400, { data: { code: "STATE_CHANGED" }, message: "x" }), "state_changed"],
    [httpError(503, { message: "Kuryer filialini aniqlab bo'lmadi" }), "unavailable"],
    [httpError(409, { code: "IDEMPOTENCY_IN_PROGRESS" }), "in_progress"],
    [httpError(422, { code: "IDEMPOTENCY_KEY_MISMATCH" }), "key_mismatch"],
    [httpError(504, {}), "no_response"],
    [httpError(500, {}), "no_response"],
    [{ isAxiosError: true, code: "ECONNABORTED", message: "timeout of 120000ms exceeded" }, "no_response"],
    [httpError(400, { code: "SUPERADMIN_ONLY", message: "Faqat superadmin" }), "rejected"],
    [httpError(400, { code: "CORRECTION_REQUIRED", message: "Buxgalteriya tuzatishi kerak" }), "rejected"],
    [httpError(403, { code: "NO_PERMISSION", message: "Huquq yo'q" }), "rejected"],
    [httpError(403, { message: "Forbidden resource" }), "rejected"],
  ] as const)("%# → %s", (error, kind) => {
    expect(classifyRollbackError(error).kind).toBe(kind);
  });

  it("server matni va kodi; javobsiz xatoda axios matni olinmaydi", () => {
    expect(classifyRollbackError(httpError(400, { code: "SUPERADMIN_ONLY", message: "Faqat superadmin" }))).toEqual({
      kind: "rejected",
      status: 400,
      code: "SUPERADMIN_ONLY",
      serverMessage: "Faqat superadmin",
    });
    expect(classifyRollbackError({ isAxiosError: true, message: "Network Error" }).serverMessage).toBeNull();
    expect(getRollbackErrorCode(httpError(400, { data: { code: "PARCEL_NOT_IN_BRANCH" } }))).toBe("PARCEL_NOT_IN_BRANCH");
    expect(getRollbackErrorCode(new Error("x"))).toBeNull();
  });

  it("qayta urinish — `rejected` dan boshqa hammasida", () => {
    expect(isRetryableRollbackError("rejected")).toBe(false);
    for (const kind of ["state_changed", "unavailable", "in_progress", "key_mismatch", "no_response"] as const) {
      expect(isRetryableRollbackError(kind), kind).toBe(true);
    }
  });
});
