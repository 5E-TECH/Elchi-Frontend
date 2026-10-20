import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markScannerCameraMounted, resetScannerHost } from "../../../shared/lib/scanner";
import {
  getOrdersRefetchInterval,
  ORDERS_REFRESH_INTERVAL_MS,
  useOrdersRefresh,
  useOrdersRefreshPaused,
  type RefreshableQuery,
} from "./useOrdersRefresh";

/**
 * OR-1 — buyurtmalar ro'yxatini yangilash modeli: 60 s + tasdiq pollingi (30 s) birlashuvi, oyna/kamera
 * ochiq bo'lsa to'xtash, «Yangilanmoqda…» 400 ms dan keyin, «Ro'yxat yangilanmadi» (× bilan yopiladi),
 * `refreshAll()` — ro'yxat + qo'shimcha so'rovlar.
 */

const query = (over: Partial<RefreshableQuery> = {}): RefreshableQuery => ({
  data: { data: [{ id: "1" }] },
  dataUpdatedAt: 1_000,
  isFetching: false,
  isError: false,
  isPlaceholderData: false,
  refetch: vi.fn().mockResolvedValue(undefined),
  ...over,
});

describe("getOrdersRefetchInterval", () => {
  it("sukut — 60 s", () => {
    expect(ORDERS_REFRESH_INTERVAL_MS).toBe(60_000);
    expect(getOrdersRefetchInterval(false)).toBe(60_000);
    expect(getOrdersRefetchInterval(false, false)).toBe(60_000);
  });

  it("tasdiq kutilayotgan bo'lsa 30 s lik polling bilan birlashadi (kichigi)", () => {
    expect(getOrdersRefetchInterval(false, 30_000)).toBe(30_000);
    expect(getOrdersRefetchInterval(false, 90_000)).toBe(60_000);
  });

  it("oyna/kamera ochiq — avtomatik yangilanish yo'q, tasdiq pollingi esa davom etadi", () => {
    expect(getOrdersRefetchInterval(true)).toBe(false);
    expect(getOrdersRefetchInterval(true, false)).toBe(false);
    expect(getOrdersRefetchInterval(true, 30_000)).toBe(30_000);
  });
});

describe("useOrdersRefreshPaused", () => {
  afterEach(() => resetScannerHost());

  it("oyna ochiq yoki skaner kamerasi sahifa ustida bo'lsa — to'xtatilgan", () => {
    const { result, rerender } = renderHook(({ dialog }) => useOrdersRefreshPaused(dialog), {
      initialProps: { dialog: false },
    });
    expect(result.current).toBe(false);
    rerender({ dialog: true });
    expect(result.current).toBe(true);
    rerender({ dialog: false });
    let unmount = () => {};
    act(() => {
      unmount = markScannerCameraMounted();
    });
    expect(result.current).toBe(true);
    act(() => unmount());
    expect(result.current).toBe(false);
  });
});

describe("useOrdersRefresh", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("«Oxirgi yangilanish» — dataUpdatedAt; ma'lumot yo'q bo'lsa 0", () => {
    const { result, rerender } = renderHook(({ list }) => useOrdersRefresh({ list }), {
      initialProps: { list: query({ dataUpdatedAt: 1_760_000_000_000 }) },
    });
    expect(result.current.lastUpdatedAt).toBe(1_760_000_000_000);
    rerender({ list: query({ data: undefined, dataUpdatedAt: 0, isFetching: true }) });
    expect(result.current.lastUpdatedAt).toBe(0);
  });

  it("fon yangilanishi faqat 400 ms dan uzoq cho'zilsa «refreshing»", () => {
    const { result, rerender } = renderHook(({ list }) => useOrdersRefresh({ list }), {
      initialProps: { list: query() },
    });
    rerender({ list: query({ isFetching: true }) });
    expect(result.current.refreshing).toBe(false);
    act(() => vi.advanceTimersByTime(399));
    expect(result.current.refreshing).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.refreshing).toBe(true);
    rerender({ list: query({ isFetching: false, dataUpdatedAt: 2_000 }) });
    expect(result.current.refreshing).toBe(false);
  });

  it("birinchi yuklanish va filtr/sahifa almashishi (oldingi ma'lumot) — fon yangilanishi emas", () => {
    const { result, rerender } = renderHook(({ list }) => useOrdersRefresh({ list }), {
      initialProps: { list: query({ data: undefined, isFetching: true }) },
    });
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.refreshing).toBe(false);
    rerender({ list: query({ isFetching: true, isPlaceholderData: true }) });
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.refreshing).toBe(false);
  });

  it("yangilash yiqildi, ma'lumot bor — ogohlantirish; × yopadi, keyingi muvaffaqiyatdan keyingi xatoda qaytadi", () => {
    const { result, rerender } = renderHook(({ list }) => useOrdersRefresh({ list }), {
      initialProps: { list: query({ isError: true }) },
    });
    expect(result.current.errorVisible).toBe(true);
    act(() => result.current.dismissError());
    expect(result.current.errorVisible).toBe(false);
    // Avtomatik urinish yana yiqildi (ma'lumot o'sha) — qayta ochilmaydi.
    rerender({ list: query({ isError: true }) });
    expect(result.current.errorVisible).toBe(false);
    // Muvaffaqiyat (yangi dataUpdatedAt), keyin yana xato — ko'rinadi.
    rerender({ list: query({ dataUpdatedAt: 2_000 }) });
    rerender({ list: query({ dataUpdatedAt: 2_000, isError: true }) });
    expect(result.current.errorVisible).toBe(true);
  });

  it("birinchi yuklash yiqilsa (ma'lumot yo'q) — ogohlantirish emas (sahifaning xato holati)", () => {
    const { result } = renderHook(() =>
      useOrdersRefresh({ list: query({ data: undefined, dataUpdatedAt: 0, isError: true }) }),
    );
    expect(result.current.errorVisible).toBe(false);
  });

  it("refreshAll: ro'yxat va qo'shimcha so'rovlar birga (biri yiqilsa ham qolganlari)", async () => {
    const list = query();
    const counts = { refetch: vi.fn().mockResolvedValue(undefined) };
    const pinned = { refetch: vi.fn().mockRejectedValue(new Error("404")) };
    const { result } = renderHook(() => useOrdersRefresh({ list, extras: [counts, false, null, pinned] }));
    await act(async () => {
      await result.current.refreshAll();
    });
    expect(list.refetch).toHaveBeenCalledTimes(1);
    expect(counts.refetch).toHaveBeenCalledTimes(1);
    expect(pinned.refetch).toHaveBeenCalledTimes(1);
  });

  it("yopilgandan keyin qo'lda «Yangilash»: so'rov ketayotganda eski xato qaytmaydi, yangi xatoda ko'rinadi", async () => {
    const { result, rerender } = renderHook(({ list }) => useOrdersRefresh({ list }), {
      initialProps: { list: query({ isError: true, errorUpdatedAt: 5_000 }) },
    });
    act(() => result.current.dismissError());
    expect(result.current.errorVisible).toBe(false);
    await act(async () => {
      await result.current.refreshAll();
    });
    rerender({ list: query({ isError: true, errorUpdatedAt: 5_000, isFetching: true }) });
    expect(result.current.errorVisible).toBe(false);
    rerender({ list: query({ isError: true, errorUpdatedAt: 7_000 }) });
    expect(result.current.errorVisible).toBe(true);
  });

  it("fetching — ro'yxat so'rovi ketmoqda («Qayta urinish» band)", () => {
    const { result } = renderHook(() => useOrdersRefresh({ list: query({ isFetching: true }) }));
    expect(result.current.fetching).toBe(true);
  });
});
