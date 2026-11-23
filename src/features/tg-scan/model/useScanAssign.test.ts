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

const httpError = (status: number, message = "Xato") =>
  Object.assign(new Error(message), { isAxiosError: true, response: { status, data: { message } } });
const timeoutError = () =>
  Object.assign(new Error("timeout of 20000ms exceeded"), { isAxiosError: true, code: "ECONNABORTED", request: {} });

describe("useScanAssign — skan auditi #32, #59, #63", () => {
  it("#32: xato bergan kod USB bilan darhol qayta skanerlansa — jim emas, qayta yuboriladi", async () => {
    const onFeedback = vi.fn();
    const assign = vi
      .fn<(token: string) => Promise<ScanAssignResult>>()
      .mockRejectedValueOnce(httpError(500))
      .mockResolvedValueOnce(ok("1"));
    const { result } = renderHook(() =>
      useScanAssign({ webApp: null, enabled: true, onSessionExpired: vi.fn(), assign, onFeedback, haptics: false }),
    );

    act(() => result.current.handleScan(TOKEN_A, "keyboard"));
    await waitFor(() => expect(onFeedback).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "failed" })));
    act(() => result.current.handleScan(TOKEN_A, "keyboard"));
    await waitFor(() => expect(onFeedback).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "assigned" })));
    expect(assign).toHaveBeenCalledTimes(2);
  });

  it("#63: yo'ldagi kod qayta o'qilsa — «pending» signali (jim emas), ikkinchi so'rov yo'q", async () => {
    const onFeedback = vi.fn();
    let resolve: (value: ScanAssignResult) => void = () => undefined;
    const assign = vi.fn(() => new Promise<ScanAssignResult>((done) => (resolve = done)));
    const { result } = renderHook(() =>
      useScanAssign({ webApp: null, enabled: true, onSessionExpired: vi.fn(), assign, onFeedback, haptics: false }),
    );

    act(() => result.current.handleScan(TOKEN_A, "keyboard"));
    act(() => result.current.handleScan(TOKEN_A, "keyboard"));
    expect(onFeedback).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "pending", token: TOKEN_A }));
    expect(assign).toHaveBeenCalledTimes(1);
    await act(async () => resolve(ok("1")));
    await waitFor(() => expect(onFeedback).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "assigned" })));
  });

  it("#59: gateway 504 — o'sha so'rov bir marta qayta yuboriladi; qayta yuborishdagi `idempotent` — «Biriktirildi»", async () => {
    const onFeedback = vi.fn();
    const assign = vi
      .fn<(token: string) => Promise<ScanAssignResult>>()
      .mockRejectedValueOnce(httpError(504, "Buyurtma xizmati vaqtida javob bermadi"))
      .mockResolvedValueOnce({ ...ok("1"), idempotent: true });
    const { result } = renderHook(() =>
      useScanAssign({ webApp: null, enabled: true, onSessionExpired: vi.fn(), assign, onFeedback, haptics: false }),
    );

    act(() => result.current.handleScan(TOKEN_A, "keyboard"));
    await waitFor(() => expect(result.current.acceptedOrderIds).toEqual(["1"]));
    expect(assign).toHaveBeenCalledTimes(2);
    expect(assign).toHaveBeenNthCalledWith(2, TOKEN_A);
    expect(onFeedback).toHaveBeenCalledTimes(1);
    expect(onFeedback).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "assigned" }));
    expect(result.current.entries[0]).toMatchObject({ status: "assigned", orderId: "1" });
  });

  it("#59: vaqt tugashi ikki marta — bitta qayta urinishdan keyin xato; 500 / oflayn qayta yuborilmaydi", async () => {
    const onFeedback = vi.fn();
    const assign = vi
      .fn<(token: string) => Promise<ScanAssignResult>>()
      .mockRejectedValueOnce(timeoutError())
      .mockRejectedValueOnce(timeoutError())
      .mockRejectedValueOnce(httpError(500));
    const { result } = renderHook(() =>
      useScanAssign({ webApp: null, enabled: true, onSessionExpired: vi.fn(), assign, onFeedback, haptics: false }),
    );

    act(() => result.current.handleScan(TOKEN_A, "keyboard"));
    await waitFor(() => expect(onFeedback).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "failed" })));
    expect(assign).toHaveBeenCalledTimes(2);

    act(() => result.current.handleScan(TOKEN_B, "keyboard"));
    await waitFor(() => expect(onFeedback).toHaveBeenCalledTimes(2));
    expect(assign).toHaveBeenCalledTimes(3);
  });

  it("birinchi urinishdagi `idempotent` (qayta yuborishsiz) — avvalgidek «Allaqachon sizda»", async () => {
    const onFeedback = vi.fn();
    const assign = vi.fn(async () => ({ ...ok("1"), idempotent: true }));
    const { result } = renderHook(() =>
      useScanAssign({ webApp: null, enabled: true, onSessionExpired: vi.fn(), assign, onFeedback, haptics: false }),
    );

    act(() => result.current.handleScan(TOKEN_A, "keyboard"));
    await waitFor(() => expect(onFeedback).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "already" })));
  });
});
