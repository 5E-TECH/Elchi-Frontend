import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getActiveScanTarget, resetScanTargets } from "./scanner/scanTargets";
import { useOrderQrScanner } from "./useOrderQrScanner";

/** Ro'yxatdagi buyurtmani QR bilan topish: USB va (1-bosqich) kamera maqsadi — bitta moslash funksiyasi. */

const ORDERS = [
  { id: 10254, qr_code_token: "65f0c1aa22bb33cc44dd55ee" },
  { id: 10253, qr_code_token: null },
];

const scan = (value: string) => {
  for (const key of value) window.dispatchEvent(new KeyboardEvent("keydown", { key }));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true }));
};

afterEach(() => {
  resetScanTargets();
});

describe("useOrderQrScanner", () => {
  it("USB: token yoki id (registrsiz) bo'yicha topadi, aks holda onMissing", () => {
    const onMatch = vi.fn();
    const onMissing = vi.fn();
    renderHook(() => useOrderQrScanner({ orders: ORDERS, onMatch, onMissing }));

    scan("65F0C1AA22BB33CC44DD55EE");
    expect(onMatch).toHaveBeenCalledWith(ORDERS[0], "65F0C1AA22BB33CC44DD55EE", "keyboard");

    scan("https://elchi.uz/scan/unknown-token");
    expect(onMissing).toHaveBeenCalledWith("https://elchi.uz/scan/unknown-token", "keyboard");
  });

  it("`camera` berilmasa — skan maqsadi yo'q (markaziy tugma universal /scan ni ochadi)", () => {
    renderHook(() => useOrderQrScanner({ orders: ORDERS, onMatch: vi.fn(), onMissing: vi.fn() }));
    expect(getActiveScanTarget()).toBeNull();
  });

  it("`camera` — maqsad ro'yxatdan o'tadi; kamera skani USB bilan bir xil moslashdan o'tadi", async () => {
    const onMatch = vi.fn();
    const onMissing = vi.fn();
    renderHook(() =>
      useOrderQrScanner({
        orders: ORDERS,
        onMatch,
        onMissing,
        camera: { id: "new-orders:market:7", title: "Qabul qilish", context: "Urgut Savdo · 6 ta buyurtma", progress: { done: 3, total: 6 } },
      }),
    );

    const target = getActiveScanTarget();
    expect(target).toMatchObject({ id: "new-orders:market:7", title: "Qabul qilish", progress: { done: 3, total: 6 } });

    await target?.onScan("10254", "camera");
    expect(onMatch).toHaveBeenCalledWith(ORDERS[0], "10254", "camera");

    await target?.onScan("deadbeefdeadbeef", "manual");
    expect(onMissing).toHaveBeenCalledWith("deadbeefdeadbeef", "manual");

    // Juda qisqa begona matn (USB'dagidek) — jim.
    await target?.onScan("ab", "camera");
    expect(onMissing).toHaveBeenCalledTimes(1);
  });

  it("enabled=false yoki ro'yxat bo'sh — maqsad ham yo'q", () => {
    const camera = { id: "x", title: "Qabul qilish" };
    const { rerender } = renderHook(
      ({ enabled, orders }) => useOrderQrScanner({ orders, enabled, onMatch: vi.fn(), onMissing: vi.fn(), camera }),
      { initialProps: { enabled: true, orders: ORDERS } },
    );
    expect(getActiveScanTarget()?.id).toBe("x");
    rerender({ enabled: false, orders: ORDERS });
    expect(getActiveScanTarget()).toBeNull();
    rerender({ enabled: true, orders: [] });
    expect(getActiveScanTarget()).toBeNull();
  });
});
