import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  closeScanner,
  isScannerCameraMounted,
  isScannerOverlayOpen,
  markScannerCameraMounted,
  openScanner,
  readScannerArrival,
  registerScannerNavigator,
  resetScannerHost,
  scannerArrivalState,
  withoutScannerArrival,
} from "./scannerHost";
import { resetScanTargets, useScanTarget } from "./scanTargets";

const Register = () => {
  useScanTarget({ id: "page", title: "Qabul qilish", onScan: vi.fn() });
  return null;
};

afterEach(() => {
  resetScanTargets();
  resetScannerHost();
});

describe("openScanner / closeScanner", () => {
  it("faol maqsad yo'q — universal /scan ga o'tadi, oyna ochilmaydi", () => {
    const navigate = vi.fn();
    expect(openScanner({ navigate })).toBe("page");
    expect(navigate).toHaveBeenCalledWith("/scan");
    expect(isScannerOverlayOpen()).toBe(false);
  });

  it("navigate berilmasa — ScannerHost ro'yxatdan o'tkazgan navigatsiya", () => {
    const navigate = vi.fn();
    const unregister = registerScannerNavigator(navigate);
    openScanner();
    expect(navigate).toHaveBeenCalledWith("/scan");
    unregister();
    openScanner();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("faol maqsad bor — kamera oynasi ochiladi, navigatsiya yo'q; closeScanner yopadi", () => {
    const navigate = vi.fn();
    render(<Register />);
    expect(openScanner({ navigate })).toBe("overlay");
    expect(navigate).not.toHaveBeenCalled();
    expect(isScannerOverlayOpen()).toBe(true);
    closeScanner();
    expect(isScannerOverlayOpen()).toBe(false);
  });

  it("kamera yuzasi hisoblagichi (global v1 xabari kamera ochiqligida chiqmaydi)", () => {
    expect(isScannerCameraMounted()).toBe(false);
    const releaseA = markScannerCameraMounted();
    const releaseB = markScannerCameraMounted();
    releaseA();
    expect(isScannerCameraMounted()).toBe(true);
    releaseB();
    expect(isScannerCameraMounted()).toBe(false);
  });
});

describe("«kelganda och» bayrog'i (router holati)", () => {
  it("yoziladi va o'qiladi; buzilgan qiymat — null; manba noma'lum bo'lsa — kamera", () => {
    const state = scannerArrivalState({ targetId: "dispatch", pendingScan: { raw: "abc", source: "keyboard" } });
    expect(readScannerArrival(state)).toEqual({ targetId: "dispatch", pendingScan: { raw: "abc", source: "keyboard" } });
    expect(readScannerArrival(null)).toBeNull();
    expect(readScannerArrival({ openScanner: "ha" })).toBeNull();
    expect(readScannerArrival({ openScanner: { pendingScan: { raw: "x", source: "?" } } })).toEqual({
      targetId: undefined,
      pendingScan: { raw: "x", source: "camera" },
    });
    expect(readScannerArrival({ openScanner: { pendingScan: { raw: "  " } } })?.pendingScan).toBeUndefined();
  });

  it("tozalashda boshqa maydonlar saqlanadi", () => {
    expect(withoutScannerArrival({ ...scannerArrivalState(), tab: "scanner" })).toEqual({ tab: "scanner" });
    expect(withoutScannerArrival(scannerArrivalState())).toBeNull();
    expect(withoutScannerArrival(undefined)).toBeNull();
  });
});
