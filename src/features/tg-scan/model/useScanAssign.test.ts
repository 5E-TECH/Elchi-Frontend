import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScanAssignResult } from "../api/tgScanApi";
import { useScanAssign } from "./useScanAssign";

/** Uzluksiz skan oqimi: tebranish (`haptics`) va kamera pauzasi (`cameraGated`) tanlovlari. */

const TOKEN_A = "a1b2c3d4e5f60718293a4b5c";
const TOKEN_B = "b1b2c3d4e5f60718293a4b5c";

const ok = (id: string): ScanAssignResult =>
  ({ idempotent: false, order_id: id, post_id: null, post_created: false, order: null }) as unknown as ScanAssignResult;

const mockVibrate = () => {
  const vibrate = vi.fn(() => true);
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
  return vibrate;
};

afterEach(() => {
  Reflect.deleteProperty(navigator, "vibrate");
});

describe("useScanAssign", () => {
  it("sukut (Mini App) — natijada o'zi tebratadi", async () => {
    const vibrate = mockVibrate();
    const assign = vi.fn(async (token: string) => ok(token === TOKEN_A ? "1" : "2"));
    const { result } = renderHook(() =>
      useScanAssign({ webApp: null, enabled: true, onSessionExpired: vi.fn(), assign }),
    );
    act(() => result.current.handleScan(TOKEN_A, "keyboard"));
    await waitFor(() => expect(result.current.acceptedOrderIds).toEqual(["1"]));
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it("`haptics: false` (asosiy ilova) — oqim tebratmaydi: tebranish faqat Sozlamalar bo'yicha `playScanFeedback` da", async () => {
    const vibrate = mockVibrate();
    const onFeedback = vi.fn();
    const assign = vi
      .fn<(token: string) => Promise<ScanAssignResult>>()
      .mockResolvedValueOnce(ok("1"))
      .mockRejectedValueOnce(Object.assign(new Error("Bad"), { isAxiosError: true, response: { status: 400, data: { message: "Xato" } } }));
    const { result } = renderHook(() =>
      useScanAssign({ webApp: null, enabled: true, onSessionExpired: vi.fn(), assign, onFeedback, haptics: false }),
    );
    act(() => result.current.handleScan(TOKEN_A, "keyboard"));
    await waitFor(() => expect(onFeedback).toHaveBeenCalledTimes(1));
    act(() => result.current.handleScan(TOKEN_B, "keyboard"));
    await waitFor(() => expect(onFeedback).toHaveBeenCalledTimes(2));
    act(() => result.current.handleScan(TOKEN_A, "keyboard"));
    act(() => result.current.handleScan("bu-qr-emas", "keyboard"));
    await waitFor(() => expect(onFeedback).toHaveBeenCalledTimes(4));
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("`cameraGated` — kamera skanlari umumiy pauzaga qayta tushmaydi (sessiya allaqachon cheklagan)", async () => {
    const assign = vi.fn(async (token: string) => ok(token === TOKEN_A ? "1" : "2"));
    const gated = renderHook(() =>
      useScanAssign({ webApp: null, enabled: true, onSessionExpired: vi.fn(), assign, haptics: false, cameraGated: true }),
    );
    act(() => {
      gated.result.current.handleScan(TOKEN_A, "camera");
      gated.result.current.handleScan(TOKEN_B, "camera");
    });
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(2));

    // Sukut — ikkinchi kod 700 ms ichida jim kutadi.
    assign.mockClear();
    const plain = renderHook(() =>
      useScanAssign({ webApp: null, enabled: true, onSessionExpired: vi.fn(), assign, haptics: false }),
    );
    act(() => {
      plain.result.current.handleScan(TOKEN_A, "camera");
      plain.result.current.handleScan(TOKEN_B, "camera");
    });
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(assign).toHaveBeenCalledTimes(1);
  });
});
