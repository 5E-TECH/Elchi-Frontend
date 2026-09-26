import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useScannerGate } from "./useScannerGate";

describe("useScannerGate.evaluateScan", () => {
  afterEach(() => vi.useRealTimers());

  it("reports WHY a scan was refused instead of just returning false", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useScannerGate({ cooldownMs: 700, duplicateCooldownMs: 1800 }));

    expect(result.current.evaluateScan("TOKEN-A")).toBe("accepted");
    expect(result.current.evaluateScan("TOKEN-B")).toBe("cooldown");
    vi.advanceTimersByTime(701);
    expect(result.current.evaluateScan("TOKEN-B")).toBe("accepted");
    // Bir xil token (katta-kichik harf farqsiz) — pauza ichida ham "juda tez"
    // emas, jim takror: kamera bir QR'ni har kadrda qayta o'qiydi.
    expect(result.current.evaluateScan("token-b")).toBe("duplicate");
    vi.advanceTimersByTime(701);
    expect(result.current.evaluateScan("token-b")).toBe("duplicate");
    vi.advanceTimersByTime(1800);
    expect(result.current.evaluateScan("token-b")).toBe("accepted");
  });

  it("lets a HID (keyboard) scanner skip the cooldown but still catches a repeated token", () => {
    const { result } = renderHook(() => useScannerGate({ cooldownMs: 700, duplicateCooldownMs: 1800 }));

    expect(result.current.evaluateScan("TOKEN-A", { ignoreCooldown: true })).toBe("accepted");
    expect(result.current.evaluateScan("TOKEN-B", { ignoreCooldown: true })).toBe("accepted");
    expect(result.current.evaluateScan("TOKEN-B", { ignoreCooldown: true })).toBe("duplicate");
  });

  it("keeps canAcceptScan backwards compatible for the other scanner pages", () => {
    const { result } = renderHook(() => useScannerGate({ cooldownMs: 700 }));

    expect(result.current.canAcceptScan("TOKEN-A")).toBe(true);
    expect(result.current.canAcceptScan("TOKEN-B")).toBe(false);
  });
});
