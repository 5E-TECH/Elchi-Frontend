import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeliveryMeasureItem } from "../model/types";
import { QUOTE_DEBOUNCE_MS, useDeliveryQuoteByTariff } from "./useDeliveryPricing";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock("../../../shared/api/api", () => ({
  api: { get: mocks.get, post: mocks.post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  API_TIMEOUT_MS: 20_000,
  LONG_REQUEST_TIMEOUT_MS: 120_000,
}));

const item = (weight: number): DeliveryMeasureItem => ({
  weight_kg: weight,
  length_cm: 30,
  width_cm: 22,
  height_cm: 15,
  volumetric_enabled: true,
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  mocks.post.mockReset();
  mocks.post.mockResolvedValue({
    data: { data: { quotes: { city: { tariffId: "city", total: 39000, billableKg: 2, extraKg: 1 } } } },
  });
});

describe("useDeliveryQuoteByTariff — ~400 ms kutish, faqat to'g'ri o'lchov", () => {
  it("`null` — so'rov yo'q, holat `idle`", async () => {
    const { result } = renderHook(() => useDeliveryQuoteByTariff(null), { wrapper });
    expect(result.current.status).toBe("idle");
    await new Promise((resolve) => setTimeout(resolve, QUOTE_DEBOUNCE_MS + 100));
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("ochilganda tayyor o'lchov (tahrirlash oynasi) — darhol so'raladi", async () => {
    const { result } = renderHook(() => useDeliveryQuoteByTariff(item(1.2)), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it("yozish paytidagi tez-tez o'zgarish — bitta so'rov, oxirgi o'lchov bilan; javob kelguncha `loading`", async () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: DeliveryMeasureItem | null }) => useDeliveryQuoteByTariff(value),
      { wrapper, initialProps: { value: null as DeliveryMeasureItem | null } },
    );
    rerender({ value: item(1) });
    expect(result.current.status).toBe("loading");
    rerender({ value: item(1.1) });
    rerender({ value: item(1.2) });
    expect(mocks.post).not.toHaveBeenCalled();

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith("delivery/quote/by-tariff", { items: [item(1.2)] });
    expect(result.current.quotes?.city?.total).toBe(39000);
    expect(result.current.quotes?.center).toBeNull();
  });

  it("xato (API hali yo'q — 404) — `error`, «Qayta urinish» qayta so'raydi", async () => {
    mocks.post.mockRejectedValueOnce(Object.assign(new Error("Not Found"), { response: { status: 404 } }));
    const { result } = renderHook(() => useDeliveryQuoteByTariff(item(1.2)), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("error"));
    result.current.retry();
    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(mocks.post).toHaveBeenCalledTimes(2);
  });
});
