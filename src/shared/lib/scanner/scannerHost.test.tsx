import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  closeScanner,
  isScannerCameraMounted,
  isScannerOverlayOpen,
  markScannerCameraMounted,
  openScanner,
  registerScannerNavigator,
  resetScannerHost,
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
