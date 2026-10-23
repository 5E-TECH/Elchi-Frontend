import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("qr-scanner", () => ({
  default: class {
    static hasCamera = () => Promise.resolve(false);
  },
}));

import QrScanner, { CameraSupportError, classifyCameraError, revealCameraStartError } from "./qrScanner";

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

describe("qrScanner.ts — inglizcha xato matni yo'q (kkDkrAIz)", () => {
  it("`grep -E '\"[A-Z][a-z]+ (not|access|is)'` → 0: jurnal satrlari ham inglizcha emas", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "src/shared/lib/qrScanner.ts"), "utf8");
    expect(source.match(/"[A-Z][a-z]+ (not|access|is)/g) ?? []).toEqual([]);
  });
});

describe("revealCameraStartError — kutubxona yutgan haqiqiy sabab (kkDkrAIz)", () => {
  const setGetUserMedia = (getUserMedia: () => Promise<unknown>) =>
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  afterEach(() => {
    Reflect.deleteProperty(navigator, "mediaDevices");
  });

  it.each([
    ["NotReadableError", "busy"],
    ["NotAllowedError", "denied"],
    ["NotFoundError", "unsupported"],
  ] as const)("kutubxona satri + getUserMedia %s → sabab %s", async (name, kind) => {
    const cause = new DOMException("raw browser text", name);
    setGetUserMedia(() => Promise.reject(cause));
    const revealed = await revealCameraStartError("Camera not found.");
    expect(revealed).toBe(cause);
    expect(classifyCameraError(revealed)).toBe(kind);
  });

  it("qayta so'rov muvaffaqiyatli — oqim yopiladi, asl xato qoladi", async () => {
    const stop = vi.fn();
    setGetUserMedia(() => Promise.resolve({ getTracks: () => [{ stop }, { stop }] }));
    expect(await revealCameraStartError("Camera not found.")).toBe("Camera not found.");
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it("boshqa xato — o'zgarmaydi, kamera qayta so'ralmaydi", async () => {
    const getUserMedia = vi.fn(() => Promise.reject(new DOMException("x", "NotAllowedError")));
    setGetUserMedia(getUserMedia);
    const other = new DOMException("busy", "NotReadableError");
    expect(await revealCameraStartError(other)).toBe(other);
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});

