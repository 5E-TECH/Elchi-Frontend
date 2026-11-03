import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  normalizePaymentCorrectionSettings,
  paymentCorrectionSettingsKey,
  toPaymentCorrectionWindowDays,
  usePaymentCorrectionSettings,
  useUpdatePaymentCorrectionSettings,
} from "./paymentCorrectionSettings";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("../../shared/api/api", () => ({ api: http, API_TIMEOUT_MS: 20_000, LONG_REQUEST_TIMEOUT_MS: 120_000 }));

/**
 * T6-FE-3 (2wgTzcG0) — `GET/PATCH finance/payment-corrections/settings` kontrakti (backend dev c93afc4, AG1Mlikw):
 * `window_days` butun 1–365 (yaroqsizi — 30), `updated_by` — ID, PATCH tanasida son.
 */

const wrapperFor = (client: QueryClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

describe("payment correction settings (T6-FE-3)", () => {
  it("normalizer: `data` envelope or bare object; the user id stays an id", () => {
    expect(
      normalizePaymentCorrectionSettings({
        statusCode: 200,
        data: { window_days: 45, updated_by: 1, updated_at: "2026-10-01T05:15:00.000Z" },
      }),
    ).toEqual({ window_days: 45, updated_by: "1", updated_at: "2026-10-01T05:15:00.000Z" });
    expect(normalizePaymentCorrectionSettings({ window_days: 7, updated_by: null, updated_at: null })).toEqual({
      window_days: 7,
      updated_by: null,
      updated_at: null,
    });
  });

  it("normalizer: no row, an unknown shape or an invalid value → 30 and «nobody changed it»", () => {
    const fallback = { window_days: 30, updated_by: null, updated_at: null };
    expect(normalizePaymentCorrectionSettings(undefined)).toEqual(fallback);
    expect(normalizePaymentCorrectionSettings({ data: { items: [], meta: { page: 1 } } })).toEqual(fallback);
    expect(normalizePaymentCorrectionSettings({ data: { account_check_enabled: false, cards: [] } })).toEqual(fallback);
    for (const bad of [0, 366, 7.5, "7", true, null, -3]) {
      expect(normalizePaymentCorrectionSettings({ data: { window_days: bad } }).window_days, String(bad)).toBe(30);
    }
  });

  it("window days: only a JSON integer from 1 to 365 (the backend rejects strings and booleans)", () => {
    expect(toPaymentCorrectionWindowDays(1)).toBe(1);
    expect(toPaymentCorrectionWindowDays(365)).toBe(365);
    for (const bad of [0, 366, 10.5, "10", true, NaN, Infinity]) expect(toPaymentCorrectionWindowDays(bad)).toBeNull();
  });

  it("GET reads the settings; PATCH sends `window_days` as a number and re-reads the settings and the history detail", async () => {
    http.get.mockResolvedValue({ data: { statusCode: 200, data: { window_days: 30, updated_by: null, updated_at: null } } });
    http.patch.mockResolvedValue({
      data: { statusCode: 200, data: { window_days: 10, updated_by: "1", updated_at: "2026-11-03T07:00:00.000Z" } },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = wrapperFor(client);

    const settings = renderHook(() => usePaymentCorrectionSettings(), { wrapper });
    await waitFor(() => expect(settings.result.current.data?.window_days).toBe(30));
    expect(http.get).toHaveBeenCalledWith("finance/payment-corrections/settings");

    const update = renderHook(() => useUpdatePaymentCorrectionSettings(), { wrapper });
    await act(() => update.result.current.mutateAsync(10));
    expect(http.patch).toHaveBeenCalledWith("finance/payment-corrections/settings", { window_days: 10 });
    expect(typeof http.patch.mock.calls[0][1].window_days).toBe("number");
    const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(keys).toContain(JSON.stringify(paymentCorrectionSettingsKey));
    expect(keys).toContain(JSON.stringify(["finance-history"]));
    // Sozlama kaliti kassa prefiksida emas — `refreshCashboxQueries` uni qayta so'ramaydi.
    expect(paymentCorrectionSettingsKey[0]).not.toBe("cashbox");
  });
});
