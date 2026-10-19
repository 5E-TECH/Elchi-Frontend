import { describe, expect, it, vi } from "vitest";

vi.mock("qr-scanner", () => ({
  default: class {
    static hasCamera = () => Promise.resolve(false);
  },
}));

import QrScanner, { CameraSupportError, classifyCameraError } from "./qrScanner";

const domError = (name: string, message = "") => Object.assign(new Error(message), { name });

describe("classifyCameraError — xom brauzer matni ekranga chiqmaydi, sabab i18n kalitiga", () => {
  it.each([
    [domError("NotAllowedError", "Permission denied"), "denied"],
    [domError("SecurityError"), "denied"],
    [domError("NotReadableError", "Could not start video source"), "busy"],
    [domError("NotFoundError"), "unsupported"],
    [domError("OverconstrainedError"), "unsupported"],
    ["Camera not found.", "unsupported"],
    [new Error("Permission dismissed"), "denied"],
    [new Error("Something else"), "unknown"],
    [new CameraSupportError("unsupported", "Camera access is not available in this browser."), "unsupported"],
  ] as const)("%s → %s", (error, kind) => {
    expect(classifyCameraError(error)).toBe(kind);
  });

  it("getSupportError — kamera yo'q: `unsupported` sababli xato", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => Promise.resolve() },
    });
    const error = await QrScanner.getSupportError();
    expect(error).toBeInstanceOf(CameraSupportError);
    expect(error?.kind).toBe("unsupported");
    Reflect.deleteProperty(navigator, "mediaDevices");
  });
});
