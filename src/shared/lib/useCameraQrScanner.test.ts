import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import i18n, { i18nReady } from "../../i18n";
import { useCameraQrScanner } from "./useCameraQrScanner";

type Deferred = { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void };

const scanners = vi.hoisted(() => ({
  starts: [] as Deferred[],
  options: [] as Array<{ preferredCamera?: string; calculateScanRegion?: unknown }>,
  setCamera: [] as string[],
  cameraCount: 1,
  flash: true,
}));

vi.mock("./qrScanner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./qrScanner")>()),
  default: class FakeQrScanner {
    static getSupportError = async () => null;
    static countCameras = async () => scanners.cameraCount;
    constructor(_video: unknown, _onDecode: unknown, options: { preferredCamera?: string; calculateScanRegion?: unknown }) {
      scanners.options.push(options);
    }
    setCamera(facing: string) {
      scanners.setCamera.push(facing);
      return Promise.resolve();
    }
    start() {
      let resolve!: () => void;
      let reject!: (error: Error) => void;
      const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      scanners.starts.push({ promise, resolve, reject });
      return promise;
    }
    pause() {
      return Promise.resolve(true);
    }
    stop() {}
    destroy() {}
    hasFlash() {
      return Promise.resolve(scanners.flash);
    }
    isFlashOn() {
      return false;
    }
    toggleFlash() {
      return Promise.resolve();
    }
  },
}));

describe("useCameraQrScanner", () => {
  it("does not report a cancelled start as a camera error (restart / StrictMode remount)", async () => {
    // jsdom'da media usullari yo'q — hook to'xtatishda ularni chaqiradi.
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    const video = document.createElement("video");
    const videoRef = { current: video };
    const { result, unmount } = renderHook(() =>
      useCameraQrScanner({ isActive: true, videoRef, onDecode: () => undefined, startErrorMessage: "start failed" }),
    );
    await waitFor(() => expect(scanners.starts).toHaveLength(1));

    // Yangi sessiya: eski `start()` hali kutmoqda.
    act(() => result.current.restartScanner());
    await waitFor(() => expect(scanners.starts).toHaveLength(2));
    await act(async () => {
      scanners.starts[1].resolve();
    });

    // Eski (bekor qilingan) ishga tushirish kech rad etadi — ishlab turgan sessiyaga xato yozilmasin.
    await act(async () => {
      scanners.starts[0].reject(new Error("The play() request was interrupted because the media was removed"));
    });

    expect(result.current.cameraError).toBe("");
    unmount();
    vi.restoreAllMocks();
  });

  it("ruxsat rad etilsa: sabab `denied`, matn tarjima qilingan (xom DOMException emas)", async () => {
    await i18nReady;
    await i18n.changeLanguage("uz");
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    const videoRef = { current: document.createElement("video") };
    const before = scanners.starts.length;
    const { result, unmount } = renderHook(() =>
      useCameraQrScanner({ isActive: true, videoRef, onDecode: () => undefined, startErrorMessage: "start failed" }),
    );
    await waitFor(() => expect(scanners.starts).toHaveLength(before + 1));
    await act(async () => {
      scanners.starts[before].reject(Object.assign(new Error("Permission denied"), { name: "NotAllowedError" }));
    });

    expect(result.current.cameraErrorKind).toBe("denied");
    expect(result.current.cameraError).toBe("Kameraga ruxsat berilmagan");
    unmount();
    vi.restoreAllMocks();
  });

  it("asosiy kamera (Sozlamalar → Skaner) va skan hududi skanerga beriladi; bir nechta kamera — almashtirish", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    scanners.cameraCount = 2;
    scanners.flash = true;
    const region = vi.fn(() => ({ x: 0, y: 0, width: 10, height: 10, downScaledWidth: 10, downScaledHeight: 10 }));
    const videoRef = { current: document.createElement("video") };
    const before = scanners.starts.length;
    const { result, unmount } = renderHook(() =>
      useCameraQrScanner({
        isActive: true,
        videoRef,
        onDecode: () => undefined,
        startErrorMessage: "start failed",
        preferredCamera: "user",
        calculateScanRegion: region,
      }),
    );
    await waitFor(() => expect(scanners.starts).toHaveLength(before + 1));
    const options = scanners.options[scanners.options.length - 1];
    expect(options.preferredCamera).toBe("user");
    expect(typeof options.calculateScanRegion).toBe("function");
    (options.calculateScanRegion as (video: HTMLVideoElement) => unknown)(videoRef.current);
    expect(region).toHaveBeenCalledWith(videoRef.current);

    await act(async () => {
      scanners.starts[before].resolve();
    });
    await waitFor(() => expect(result.current.canSwitchCamera).toBe(true));
    expect(result.current.facing).toBe("user");

    await act(async () => {
      await result.current.switchCamera();
    });
    expect(scanners.setCamera).toEqual(["environment"]);
    expect(result.current.facing).toBe("environment");
    expect(result.current.hasTorch).toBe(true);
    unmount();
    scanners.cameraCount = 1;
    vi.restoreAllMocks();
  });

  it("bitta kamera — almashtirish yo'q; sukut — orqa kamera", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => undefined);
    const before = scanners.starts.length;
    const videoRef = { current: document.createElement("video") };
    const { result, unmount } = renderHook(() =>
      useCameraQrScanner({
        isActive: true,
        videoRef,
        onDecode: () => undefined,
        startErrorMessage: "start failed",
      }),
    );
    await waitFor(() => expect(scanners.starts).toHaveLength(before + 1));
    await waitFor(() => expect(scanners.options.length).toBeGreaterThan(0));
    expect(scanners.options[scanners.options.length - 1].preferredCamera).toBe("environment");
    expect(scanners.options[scanners.options.length - 1].calculateScanRegion).toBeUndefined();
    await act(async () => {
      scanners.starts[before].resolve();
    });
    expect(result.current.canSwitchCamera).toBe(false);
    unmount();
    vi.restoreAllMocks();
  });
});
