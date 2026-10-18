import { afterEach, describe, expect, it } from "vitest";
import {
  clearRuntimeError,
  getCurrentAppPath,
  getRuntimeError,
  getRuntimeErrorCode,
  getRuntimeErrorRecoveryPath,
  isRuntimeErrorRepeated,
  RUNTIME_ERROR_REPEAT_WINDOW_MS,
  RUNTIME_ERROR_STORAGE_KEY,
  saveRuntimeError,
} from "./runtimeError";

describe("runtime error recovery", () => {
  afterEach(() => {
    clearRuntimeError();
    window.history.replaceState({}, "", "/");
  });

  it("preserves the current route including search and hash", () => {
    window.history.replaceState({}, "", "/payments/main-cashbox?page=2#history");

    expect(getCurrentAppPath()).toBe("/payments/main-cashbox?page=2#history");
  });

  it("never retries the runtime error page itself", () => {
    window.history.replaceState({}, "", "/runtime-error");

    expect(getCurrentAppPath()).toBe("/");
    expect(getRuntimeErrorRecoveryPath({ sourcePath: "/runtime-error" })).toBe("/");
    expect(getRuntimeErrorRecoveryPath({ sourcePath: "//external.example" })).toBe("/");
  });

  it("stores and restores the original route", () => {
    saveRuntimeError({
      message: "Render failed",
      sourcePath: "/payments/main-cashbox",
    });

    expect(getRuntimeError()).toEqual({
      message: "Render failed",
      sourcePath: "/payments/main-cashbox",
      retryCount: 1,
    });
    expect(getRuntimeErrorRecoveryPath(getRuntimeError())).toBe(
      "/payments/main-cashbox",
    );

    clearRuntimeError();
    expect(sessionStorage.getItem(RUNTIME_ERROR_STORAGE_KEY)).toBeNull();
  });
});

/** L6q4DiGU — bir sahifa ketma-ket yiqilsa «Qayta urinish» cheksiz halqa bo'lmasin. */
describe("takroriy xato hisoblagichi", () => {
  afterEach(() => clearRuntimeError());

  it("bir xil sourcePath bilan 2 marta saqlansa — retryCount 2, takroriy", () => {
    saveRuntimeError({ message: "r.forEach is not a function", sourcePath: "/orders" });
    expect(getRuntimeError()?.retryCount).toBe(1);
    expect(isRuntimeErrorRepeated(getRuntimeError())).toBe(false);

    saveRuntimeError({ message: "r.forEach is not a function", sourcePath: "/orders" });
    expect(getRuntimeError()?.retryCount).toBe(2);
    expect(isRuntimeErrorRepeated(getRuntimeError())).toBe(true);

    saveRuntimeError({ message: "r.forEach is not a function", sourcePath: "/orders" });
    expect(getRuntimeError()?.retryCount).toBe(3);
  });

  it("boshqa sahifa yoki tozalangan yozuv — hisoblagich 1 dan", () => {
    saveRuntimeError({ message: "boom", sourcePath: "/orders" });
    saveRuntimeError({ message: "boom", sourcePath: "/orders?page=2" });
    expect(getRuntimeError()?.retryCount).toBe(1);

    clearRuntimeError();
    saveRuntimeError({ message: "boom", sourcePath: "/orders?page=2" });
    expect(getRuntimeError()?.retryCount).toBe(1);
  });

  it("oldingi yiqilishdan 5 daqiqadan ko'p o'tgan — yangi xato", () => {
    const first = Date.parse("2026-10-18T10:00:00Z");
    saveRuntimeError({ sourcePath: "/orders", occurredAt: new Date(first).toISOString() });
    saveRuntimeError({ sourcePath: "/orders", occurredAt: new Date(first + 60_000).toISOString() });
    expect(getRuntimeError()?.retryCount).toBe(2);

    saveRuntimeError({
      sourcePath: "/orders",
      occurredAt: new Date(first + 60_000 + RUNTIME_ERROR_REPEAT_WINDOW_MS + 1).toISOString(),
    });
    expect(getRuntimeError()?.retryCount).toBe(1);
  });

  it("yozuvsiz yoki hisoblagichsiz eski yozuv — takroriy emas", () => {
    expect(isRuntimeErrorRepeated(null)).toBe(false);
    expect(isRuntimeErrorRepeated({ message: "boom" })).toBe(false);
  });
});

describe("xato kodi", () => {
  it("ERR-XXXX; bir xil xabar va sahifa — bir xil kod (so'rov qatori farq qilmaydi)", () => {
    const code = getRuntimeErrorCode({ message: "r.forEach is not a function", sourcePath: "/orders?page=2" });
    expect(code).toMatch(/^ERR-[0-9A-F]{4}$/);
    expect(getRuntimeErrorCode({ message: "r.forEach is not a function", sourcePath: "/orders#x" })).toBe(code);
    expect(getRuntimeErrorCode({ message: "boshqa xato", sourcePath: "/orders" })).not.toBe(code);
    expect(getRuntimeErrorCode(null)).toMatch(/^ERR-[0-9A-F]{4}$/);
  });
});
