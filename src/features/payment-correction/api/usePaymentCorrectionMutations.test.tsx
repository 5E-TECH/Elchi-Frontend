import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emitNetworkRestored, getNetworkDownKind, markNetworkDown } from "../../../auth/networkError";
import {
  normalizePaymentCorrectionResult,
  paymentCorrectionFingerprint,
  useCorrectPaymentAmount,
  useReversePayment,
} from "./usePaymentCorrectionMutations";

/**
 * T6 N2 — `POST finance/history/:id/reverse` va `…/correct-amount` (backend PR #623, openapi): tana aynan
 * `{ reason }` / `{ new_amount, reason }`; `Idempotency-Key` — tana barmoq iziga bog'langan (javobsiz qayta yuborish —
 * o'sha kalit, tana o'zgarsa — yangi, muvaffaqiyatdan keyin — yangi); global tarmoq xabari o'chiq; muvaffaqiyat,
 * noma'lum natija va ALREADY_CORRECTED da kassa va tarix keshi eskiradi.
 */

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../../../shared/api/api", () => ({
  api: { get: vi.fn(), post: mocks.post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const http = (status: number, data: Record<string, unknown> = {}) =>
  Object.assign(new Error(`Request failed with status code ${status}`), { isAxiosError: true, response: { status, data }, request: {} });
const network = () => Object.assign(new Error("Network Error"), { isAxiosError: true, code: "ERR_NETWORK", request: {} });

const created = (action: "reverse" | "edit", idempotent = false) => ({
  data: {
    statusCode: idempotent ? 200 : 201,
    message: action === "reverse" ? "To'lov qaytarildi" : "To'lov summasi tuzatildi",
    data: {
      correction: {
        id: "12",
        action,
        payment_kind: "courier_payment",
        original_amount: 1850000,
        new_amount: action === "edit" ? 1500000 : null,
        reason: "Kuryer pulni bermagan",
        created_by: "1",
        created_at: "2026-11-08T09:00:00.000Z",
      },
      cashboxes: [],
      idempotent,
    },
  },
});

const HISTORY_KEY = ["finance-history", "4512"];
const OTHER_HISTORY_KEY = ["finance-history", "4498"];
const CASHBOX_KEY = ["cashbox", "main"];

const setup = <T,>(hook: () => T) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  client.setQueryData(HISTORY_KEY, { id: "4512" });
  client.setQueryData(OTHER_HISTORY_KEY, { id: "4498" });
  client.setQueryData(CASHBOX_KEY, { balance: 1 });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(hook, { wrapper });
  return {
    result,
    stale: () => ({
      history: Boolean(client.getQueryState(HISTORY_KEY)?.isInvalidated),
      cashbox: Boolean(client.getQueryState(CASHBOX_KEY)?.isInvalidated),
    }),
    otherStale: () => Boolean(client.getQueryState(OTHER_HISTORY_KEY)?.isInvalidated),
  };
};

const call = (index: number) => {
  const [url, body, config] = mocks.post.mock.calls[index] as [string, unknown, { headers: Record<string, string>; silentNetworkError?: boolean }];
  return { url, body, key: config.headers["Idempotency-Key"], config };
};

const attempt = async (promise: Promise<unknown>) => {
  await act(async () => {
    await promise.catch(() => undefined);
  });
};

afterEach(() => {
  mocks.post.mockReset();
  // Aloqa holati modul darajasida — keyingi testga o'tmasin.
  if (getNetworkDownKind()) emitNetworkRestored();
});

describe("useReversePayment", () => {
  it("tana aynan `{ reason }` (trim), yo'l, `Idempotency-Key`, global tarmoq xabari o'chiq; natija", async () => {
    mocks.post.mockResolvedValueOnce(created("reverse"));
    const { result } = setup(() => useReversePayment());
    let value: unknown;
    await act(async () => {
      value = await result.current.mutateAsync({ historyId: "4512", reason: "  Kuryer pulni bermagan  " });
    });
    const first = call(0);
    expect(first.url).toBe("finance/history/4512/reverse");
    expect(first.body).toEqual({ reason: "Kuryer pulni bermagan" });
    expect(Object.keys(first.body as object)).toEqual(["reason"]);
    expect(first.key).toEqual(expect.any(String));
    expect(first.key.length).toBeGreaterThanOrEqual(8);
    expect(first.config.silentNetworkError).toBe(true);
    expect(value).toEqual({ idempotent: false, correctionId: "12", action: "reverse", originalAmount: 1850000, newAmount: null });
  });

  it("javobsiz (tarmoq) → qayta yuborish AYNI kalit va tana bilan; 200 `idempotent` — muvaffaqiyat; keyingisi — yangi kalit", async () => {
    mocks.post
      .mockRejectedValueOnce(network())
      .mockResolvedValueOnce(created("reverse", true))
      .mockResolvedValueOnce(created("reverse"));
    const { result } = setup(() => useReversePayment());
    const input = { historyId: "4512", reason: "Kuryer pulni bermagan" };
    await attempt(result.current.mutateAsync(input));
    let replay: unknown;
    await act(async () => {
      replay = await result.current.mutateAsync(input);
    });
    expect(call(1).key).toBe(call(0).key);
    expect(call(1).body).toEqual(call(0).body);
    expect(replay).toMatchObject({ idempotent: true });

    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(call(2).key).not.toBe(call(0).key);
  });

  it("sabab o'zgarsa — yangi kalit; eski tanaga qaytilsa — o'sha eski kalit (trim farqi — o'sha kalit)", async () => {
    mocks.post.mockRejectedValue(http(504));
    const { result } = setup(() => useReversePayment());
    await attempt(result.current.mutateAsync({ historyId: "4512", reason: "Kuryer pulni bermagan" }));
    await attempt(result.current.mutateAsync({ historyId: "4512", reason: "Xato bosilgan, kuryer bermagan" }));
    await attempt(result.current.mutateAsync({ historyId: "4512", reason: "  Kuryer pulni bermagan " }));
    expect(call(1).key).not.toBe(call(0).key);
    expect(call(2).key).toBe(call(0).key);
  });

  it("muvaffaqiyat — kassa va tarix (ochiq tafsilot ham) keshi eskiradi", async () => {
    mocks.post.mockResolvedValueOnce(created("reverse"));
    const { result, stale } = setup(() => useReversePayment());
    expect(stale()).toEqual({ history: false, cashbox: false });
    await act(async () => {
      await result.current.mutateAsync({ historyId: "4512", reason: "Kuryer pulni bermagan" });
    });
    expect(stale()).toEqual({ history: true, cashbox: true });
  });

  it("504 (bajarilgan bo'lishi mumkin) — kesh eskiradi; aniq 4xx (SHIFT_REQUIRED) — eskirmaydi, kalit saqlanadi", async () => {
    mocks.post.mockRejectedValueOnce(http(504, { message: "Moliya xizmati vaqtida javob bermadi (timeout)" }));
    const uncertain = setup(() => useReversePayment());
    await attempt(uncertain.result.current.mutateAsync({ historyId: "4512", reason: "Kuryer pulni bermagan" }));
    expect(uncertain.stale()).toEqual({ history: true, cashbox: true });

    mocks.post.mockReset();
    mocks.post.mockRejectedValueOnce(http(400, { code: "SHIFT_REQUIRED" })).mockResolvedValueOnce(created("reverse"));
    const definite = setup(() => useReversePayment());
    await attempt(definite.result.current.mutateAsync({ historyId: "4512", reason: "Kuryer pulni bermagan" }));
    expect(definite.stale()).toEqual({ history: false, cashbox: false });
    await act(async () => {
      await definite.result.current.mutateAsync({ historyId: "4512", reason: "Kuryer pulni bermagan" });
    });
    expect(call(1).key).toBe(call(0).key);
  });

  it("ALREADY_CORRECTED — kesh eskiradi, kalitlar tashlanadi; IDEMPOTENCY_KEY_REUSED — kalit tashlanadi", async () => {
    mocks.post.mockRejectedValueOnce(http(409, { code: "ALREADY_CORRECTED" })).mockRejectedValueOnce(http(504));
    const already = setup(() => useReversePayment());
    const input = { historyId: "4512", reason: "Kuryer pulni bermagan" };
    await attempt(already.result.current.mutateAsync(input));
    expect(already.stale()).toEqual({ history: true, cashbox: true });
    await attempt(already.result.current.mutateAsync(input));
    expect(call(1).key).not.toBe(call(0).key);

    mocks.post.mockReset();
    mocks.post.mockRejectedValueOnce(http(409, { code: "IDEMPOTENCY_KEY_REUSED" })).mockRejectedValueOnce(http(504));
    const reused = setup(() => useReversePayment());
    await attempt(reused.result.current.mutateAsync(input));
    expect(reused.stale()).toEqual({ history: false, cashbox: false });
    await attempt(reused.result.current.mutateAsync(input));
    expect(call(1).key).not.toBe(call(0).key);
  });
});

describe("xatodan keyin yangilash", () => {
  it.each([
    ["COURIER_MOVED", http(409, { code: "COURIER_MOVED" })],
    ["WINDOW_EXPIRED", http(409, { code: "WINDOW_EXPIRED", deadline: "2026-10-02T12:30:00.000Z", window_days: 30 })],
    ["LEGACY_UNLINKED", http(409, { code: "LEGACY_UNLINKED" })],
    ["NOT_CORRECTABLE (sababli)", http(409, { code: "NOT_CORRECTABLE", reason: "cashbox_deleted" })],
  ])("%s (doimiy hukm) — faqat ochiq tafsilot qayta o'qiladi (`correctable` qulfga o'tadi), kassa emas", async (_code, error) => {
    mocks.post.mockRejectedValueOnce(error);
    const { result, stale, otherStale } = setup(() => useReversePayment());
    await attempt(result.current.mutateAsync({ historyId: "4512", reason: "Kuryer pulni bermagan" }));
    expect(stale()).toEqual({ history: true, cashbox: false });
    expect(otherStale()).toBe(false);
  });

  it.each([
    ["CARD_ARCHIVED", http(409, { code: "CARD_ARCHIVED" })],
    ["NOT_CORRECTABLE (sababsiz — summa tekshiruvi)", http(409, { code: "NOT_CORRECTABLE" })],
    ["INSUFFICIENT_BALANCE", http(409, { code: "INSUFFICIENT_BALANCE", required: 100 })],
  ])("%s — `correctable` da ko'rinmaydi: hech narsa so'ralmaydi", async (_code, error) => {
    mocks.post.mockRejectedValueOnce(error);
    const { result, stale } = setup(() => useCorrectPaymentAmount());
    await attempt(result.current.mutateAsync({ historyId: "4512", newAmount: 1_500_000, reason: "Summa xato kiritilgan" }));
    expect(stale()).toEqual({ history: false, cashbox: false });
  });

  it("javobsiz va aloqa uzilgan (Wi-Fi bor, server yo'q) — darhol so'ralmaydi (global xabar takrorlanmasin), aloqa tiklangach yangilanadi", async () => {
    mocks.post.mockRejectedValue(network());
    const { result, stale } = setup(() => useReversePayment());
    // Interceptor `silentNetworkError` da ham uzilishni belgilaydi (`markNetworkDown`).
    markNetworkDown("offline");
    await attempt(result.current.mutateAsync({ historyId: "4512", reason: "Kuryer pulni bermagan" }));
    await attempt(result.current.mutateAsync({ historyId: "4512", reason: "Kuryer pulni bermagan" }));
    expect(stale()).toEqual({ history: false, cashbox: false });

    await act(async () => {
      emitNetworkRestored();
    });
    expect(stale()).toEqual({ history: true, cashbox: true });
  });

  it("javobsiz, lekin aloqa belgilanmagan (masalan bekor qilingan) — darhol yangilanadi", async () => {
    mocks.post.mockRejectedValueOnce(network());
    const { result, stale } = setup(() => useReversePayment());
    await attempt(result.current.mutateAsync({ historyId: "4512", reason: "Kuryer pulni bermagan" }));
    expect(stale()).toEqual({ history: true, cashbox: true });
  });
});

describe("useCorrectPaymentAmount", () => {
  it("tana aynan `{ new_amount, reason }` (son, trim), yo'l, kalit", async () => {
    mocks.post.mockResolvedValueOnce(created("edit"));
    const { result } = setup(() => useCorrectPaymentAmount());
    let value: unknown;
    await act(async () => {
      value = await result.current.mutateAsync({ historyId: "4498", newAmount: 2000000, reason: " Summa xato kiritilgan " });
    });
    const first = call(0);
    expect(first.url).toBe("finance/history/4498/correct-amount");
    expect(first.body).toEqual({ new_amount: 2000000, reason: "Summa xato kiritilgan" });
    expect(Object.keys(first.body as object).sort()).toEqual(["new_amount", "reason"]);
    expect(typeof (first.body as { new_amount: unknown }).new_amount).toBe("number");
    expect(first.config.silentNetworkError).toBe(true);
    expect(value).toMatchObject({ action: "edit", newAmount: 1500000 });
  });

  it("summa o'zgarsa — yangi kalit; o'sha summa va sabab bilan qayta — o'sha kalit", async () => {
    mocks.post.mockRejectedValue(network());
    const { result } = setup(() => useCorrectPaymentAmount());
    await attempt(result.current.mutateAsync({ historyId: "4498", newAmount: 20000000, reason: "Summa xato kiritilgan" }));
    await attempt(result.current.mutateAsync({ historyId: "4498", newAmount: 7000000, reason: "Summa xato kiritilgan" }));
    await attempt(result.current.mutateAsync({ historyId: "4498", newAmount: 20000000, reason: "Summa xato kiritilgan" }));
    expect(call(1).key).not.toBe(call(0).key);
    expect(call(2).key).toBe(call(0).key);
  });

  it("AMOUNT_EXCEEDS (aniq 409) — kesh eskirmaydi", async () => {
    mocks.post.mockRejectedValueOnce(http(409, { code: "AMOUNT_EXCEEDS", max: 7220000 }));
    const { result, stale } = setup(() => useCorrectPaymentAmount());
    await attempt(result.current.mutateAsync({ historyId: "4498", newAmount: 20000000, reason: "Summa xato kiritilgan" }));
    expect(stale()).toEqual({ history: false, cashbox: false });
  });
});

describe("yordamchilar", () => {
  it("barmoq izi: amal | oyoq | trim sabab | summa (2 xona)", () => {
    expect(paymentCorrectionFingerprint("reverse", { historyId: "4512", reason: "  Sabab bor " })).toBe("reverse|4512|Sabab bor|");
    expect(paymentCorrectionFingerprint("edit", { historyId: "4498", reason: "Sabab bor", newAmount: 2000000.004 })).toBe(
      "edit|4498|Sabab bor|2000000",
    );
  });

  it("javob normalizatori himoyaviy", () => {
    expect(normalizePaymentCorrectionResult(null)).toEqual({
      idempotent: false,
      correctionId: null,
      action: null,
      originalAmount: null,
      newAmount: null,
    });
    expect(normalizePaymentCorrectionResult({ data: { idempotent: true, correction: { id: 5, action: "edit", new_amount: "10" } } })).toEqual({
      idempotent: true,
      correctionId: "5",
      action: "edit",
      originalAmount: null,
      newAmount: 10,
    });
  });
});
