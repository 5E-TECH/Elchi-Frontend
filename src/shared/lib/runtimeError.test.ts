import { afterEach, describe, expect, it } from "vitest";
import {
  clearRuntimeError,
  getCurrentAppPath,
  getRuntimeError,
  getRuntimeErrorRecoveryPath,
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
    });
    expect(getRuntimeErrorRecoveryPath(getRuntimeError())).toBe(
      "/payments/main-cashbox",
    );

    clearRuntimeError();
    expect(sessionStorage.getItem(RUNTIME_ERROR_STORAGE_KEY)).toBeNull();
  });
});
