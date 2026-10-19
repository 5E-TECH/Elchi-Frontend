import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { averageLuma, LOW_LIGHT_INTERVAL_MS, useLowLight } from "./useLowLight";

/** «Chiroq — avtomatik»: yorug'lik kam bo'lsa chiroqni yoqish taklif qilinadi (o'zi yoqilmaydi). */

const pixels = (value: number) => {
  const data = new Uint8ClampedArray(32 * 24 * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
  return data;
};

const fakeVideo = () => {
  const video = document.createElement("video");
  Object.defineProperty(video, "readyState", { configurable: true, value: 4 });
  return { current: video };
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("averageLuma", () => {
  it("qora — 0, oq — 255, bo'sh — 255 (taklif yo'q)", () => {
    expect(averageLuma(pixels(0))).toBe(0);
    expect(averageLuma(pixels(255))).toBeCloseTo(255, 5);
    expect(averageLuma([])).toBe(255);
  });
});

describe("useLowLight", () => {
  const mockCanvas = (luma: { value: number }) => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () =>
        ({
          drawImage: vi.fn(),
          getImageData: () => ({ data: pixels(luma.value) }),
        }) as unknown as CanvasRenderingContext2D,
    );
  };

  it("ketma-ket 2 qorong'i kadr — taklif; yorug' bo'lsa yo'qoladi", () => {
    vi.useFakeTimers();
    const luma = { value: 20 };
    mockCanvas(luma);
    const videoRef = fakeVideo();
    const { result } = renderHook(() => useLowLight({ videoRef, enabled: true }));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(LOW_LIGHT_INTERVAL_MS));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(LOW_LIGHT_INTERVAL_MS));
    expect(result.current).toBe(true);
    luma.value = 160;
    act(() => vi.advanceTimersByTime(LOW_LIGHT_INTERVAL_MS));
    expect(result.current).toBe(false);
  });

  it("o'chiq (sozlama o'chiq, chiroq yo'q yoki yoqilgan) — o'lchamaydi", () => {
    vi.useFakeTimers();
    mockCanvas({ value: 5 });
    const { result } = renderHook(() => useLowLight({ videoRef: fakeVideo(), enabled: false }));
    act(() => vi.advanceTimersByTime(LOW_LIGHT_INTERVAL_MS * 4));
    expect(result.current).toBe(false);
  });

  it("kadrni o'qib bo'lmaydi (canvas yo'q) — taklif yo'q, xato yo'q", () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);
    const { result } = renderHook(() => useLowLight({ videoRef: fakeVideo(), enabled: true }));
    act(() => vi.advanceTimersByTime(LOW_LIGHT_INTERVAL_MS * 4));
    expect(result.current).toBe(false);
  });
});
