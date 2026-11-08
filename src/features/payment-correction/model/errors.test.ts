import { describe, expect, it } from "vitest";
import { correctionErrorNeedsRefresh, correctionErrorResetsKeys, readCorrectionError } from "./errors";

/**
 * T6 N2 — xato konverti (backend `all-exceptions.filter.ts`, `public-error-fields.ts`): `code` va ro'yxatdagi
 * maydonlar YUQORI darajada; xabar matni solishtirilmaydi; javobsiz / 502–504 — natija noma'lum.
 */

const http = (status: number, data: Record<string, unknown>) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
    request: {},
  });

const network = () => Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK", request: {} });

describe("readCorrectionError", () => {
  it("WINDOW_EXPIRED: `deadline`, `window_days` yuqori darajada", () => {
    expect(
      readCorrectionError(
        http(409, {
          statusCode: 409,
          message: "To'lovni tuzatish muddati o'tgan",
          code: "WINDOW_EXPIRED",
          deadline: "2026-10-02T12:30:00.000Z",
          window_days: 30,
          trace_id: "t1",
        }),
      ),
    ).toEqual({
      status: 409,
      code: "WINDOW_EXPIRED",
      reason: null,
      deadline: "2026-10-02T12:30:00.000Z",
      windowDays: 30,
      required: null,
      max: null,
      uncertain: false,
    });
  });

  it("NOT_CORRECTABLE `reason`; correct-amount gateway tekshiruvida `reason` yo'q — `null`", () => {
    expect(readCorrectionError(http(409, { code: "NOT_CORRECTABLE", reason: "cashbox_deleted" }))).toMatchObject({
      code: "NOT_CORRECTABLE",
      reason: "cashbox_deleted",
    });
    expect(readCorrectionError(http(409, { code: "NOT_CORRECTABLE", message: "Summani tuzatib bo'lmaydi: …" }))).toMatchObject({
      code: "NOT_CORRECTABLE",
      reason: null,
    });
    // Noma'lum sabab — tashlanadi.
    expect(readCorrectionError(http(409, { code: "NOT_CORRECTABLE", reason: "weird" })).reason).toBeNull();
  });

  it("INSUFFICIENT_BALANCE `required`, AMOUNT_EXCEEDS `max` (son satri ham); 0 / yo'q — `null`", () => {
    expect(readCorrectionError(http(409, { code: "INSUFFICIENT_BALANCE", required: 200000 })).required).toBe(200000);
    expect(readCorrectionError(http(409, { code: "INSUFFICIENT_BALANCE", required: 0 })).required).toBeNull();
    expect(readCorrectionError(http(409, { code: "AMOUNT_EXCEEDS", max: "7220000" })).max).toBe(7220000);
    expect(readCorrectionError(http(409, { code: "AMOUNT_EXCEEDS" })).max).toBeNull();
    // Maydon boshqa kodda kelsa — o'qilmaydi.
    expect(readCorrectionError(http(409, { code: "CARD_ARCHIVED", max: 5, required: 7 }))).toMatchObject({
      max: null,
      required: null,
    });
  });

  it("gateway o'rami (`data.code`, `data.max`) — zaxira", () => {
    expect(readCorrectionError(http(409, { data: { code: "AMOUNT_EXCEEDS", max: 100 } }))).toMatchObject({
      code: "AMOUNT_EXCEEDS",
      max: 100,
    });
  });

  it("noma'lum kod va matnli xabar — `code: null` (xabar matni kod emas)", () => {
    expect(readCorrectionError(http(409, { code: "SOMETHING_ELSE" })).code).toBeNull();
    expect(readCorrectionError(http(400, { message: "Sabab 5…500 belgi bo'lishi kerak" })).code).toBeNull();
    expect(readCorrectionError(http(403, { message: "Bu amal uchun ruxsat yo'q" }))).toMatchObject({
      status: 403,
      code: null,
      uncertain: false,
    });
  });

  it("natija noma'lum: javobsiz tarmoq, vaqt tugashi, 502/503/504; 409 va 500 — yo'q; dastur xatosi — yo'q", () => {
    expect(readCorrectionError(network()).uncertain).toBe(true);
    expect(
      readCorrectionError(Object.assign(new Error("timeout of 20000ms exceeded"), { isAxiosError: true, code: "ECONNABORTED" }))
        .uncertain,
    ).toBe(true);
    expect(readCorrectionError(http(504, { message: "Moliya xizmati vaqtida javob bermadi (timeout)" })).uncertain).toBe(true);
    expect(readCorrectionError(http(503, { message: "Tekshiruv xizmati javob bermadi" })).uncertain).toBe(true);
    expect(readCorrectionError(http(502, {})).uncertain).toBe(true);
    expect(readCorrectionError(http(409, { code: "ALREADY_CORRECTED" })).uncertain).toBe(false);
    expect(readCorrectionError(http(500, {})).uncertain).toBe(false);
    expect(readCorrectionError(new TypeError("x is undefined")).uncertain).toBe(false);
  });

  it("yangilash: noma'lum natija, ALREADY_CORRECTED, NOT_FOUND; kalit tashlash: kalit xatolari va ALREADY_CORRECTED", () => {
    const of = (error: unknown) => readCorrectionError(error);
    expect(correctionErrorNeedsRefresh(of(http(504, {})))).toBe(true);
    expect(correctionErrorNeedsRefresh(of(http(409, { code: "ALREADY_CORRECTED" })))).toBe(true);
    expect(correctionErrorNeedsRefresh(of(http(404, { code: "NOT_FOUND" })))).toBe(true);
    expect(correctionErrorNeedsRefresh(of(http(400, { code: "SHIFT_REQUIRED" })))).toBe(false);

    expect(correctionErrorResetsKeys(of(http(409, { code: "IDEMPOTENCY_KEY_REUSED" })))).toBe(true);
    expect(correctionErrorResetsKeys(of(http(400, { code: "IDEMPOTENCY_KEY_REQUIRED" })))).toBe(true);
    expect(correctionErrorResetsKeys(of(http(409, { code: "ALREADY_CORRECTED" })))).toBe(true);
    expect(correctionErrorResetsKeys(of(http(504, {})))).toBe(false);
    expect(correctionErrorResetsKeys(of(http(409, { code: "AMOUNT_EXCEEDS", max: 1 })))).toBe(false);
  });
});
