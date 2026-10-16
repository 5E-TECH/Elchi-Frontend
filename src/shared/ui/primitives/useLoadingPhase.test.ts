import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SKELETON_DELAY_MS, SLOW_LOADING_MS, useDelayedFlag, useLoadingPhase } from "./useLoadingPhase";

/** Kutish zinapoyasi (`tizim-loading` 01): 400 ms dan skelet, 15 s dan «sekin» izohi. */

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDelayedFlag", () => {
  it("faqat `delay` ms uzluksiz yoqilgandan keyin `true`; tushsa — darhol `false`, hisob boshidan", () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedFlag(active, 400), {
      initialProps: { active: true },
    });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(399));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);

    rerender({ active: false });
    expect(result.current).toBe(false);

    // Qayta yoqildi — yana 400 ms kutiladi (oldingi vaqt hisobga olinmaydi).
    rerender({ active: true });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(200));
    rerender({ active: false });
    rerender({ active: true });
    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current).toBe(true);
  });

  it("`delay <= 0` — kechikishsiz", () => {
    const { result } = renderHook(() => useDelayedFlag(true, 0));
    expect(result.current).toBe(true);
  });
});

describe("useLoadingPhase", () => {
  it("400 ms dan `visible`, 15 s dan `slow`; tez tugasa — hech biri", () => {
    const { result, rerender } = renderHook(({ active }) => useLoadingPhase(active), {
      initialProps: { active: true },
    });
    expect(result.current).toEqual({ visible: false, slow: false });
    act(() => vi.advanceTimersByTime(SKELETON_DELAY_MS));
    expect(result.current).toEqual({ visible: true, slow: false });
    act(() => vi.advanceTimersByTime(SLOW_LOADING_MS - SKELETON_DELAY_MS));
    expect(result.current).toEqual({ visible: true, slow: true });

    rerender({ active: false });
    expect(result.current).toEqual({ visible: false, slow: false });
  });

  it("`slowAfter: false` — izoh hech qachon chiqmaydi; o'z `delay`", () => {
    const { result } = renderHook(() => useLoadingPhase(true, { delay: 100, slowAfter: false }));
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.visible).toBe(true);
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.slow).toBe(false);
  });
});
