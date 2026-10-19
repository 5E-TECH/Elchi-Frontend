import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import i18n, { i18nReady } from "../../i18n";
import { useCameraQrScanner } from "./useCameraQrScanner";

type Deferred = { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void };

const scanners = vi.hoisted(() => ({ starts: [] as Deferred[] }));

vi.mock("./qrScanner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./qrScanner")>()),
  default: class FakeQrScanner {
    static getSupportError = async () => null;
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
      return Promise.resolve(false);
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
});
