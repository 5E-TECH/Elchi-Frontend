import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INSTALLED_STORAGE_KEY,
  getInstallSnapshot,
  isIosDevice,
  promptInstall,
  subscribeInstall,
} from "./installPrompt";
import {
  IPADOS_UA,
  IPHONE_UA,
  fireAppInstalled,
  fireBeforeInstallPrompt,
  resetInstallEnv,
  restoreInstallEnv,
  setDevice,
  setStandalone,
} from "../test/installEnv";

describe("pwa-install: holat (installed | installable | ios | unsupported)", () => {
  beforeEach(resetInstallEnv);
  afterEach(restoreInstallEnv);

  it("hodisasiz oddiy brauzer — unsupported", () => {
    expect(getInstallSnapshot()).toBe("unsupported");
  });

  it("display-mode: standalone — installed (iOS'da ham)", () => {
    setDevice(IPHONE_UA, 5);
    setStandalone(true);
    expect(getInstallSnapshot()).toBe("installed");
  });

  it("iPhone va iPadOS (Macintosh + sensorli ekran) — ios; sensorsiz Mac — ios emas", () => {
    expect(isIosDevice(IPHONE_UA, 5)).toBe(true);
    expect(isIosDevice(IPADOS_UA, 5)).toBe(true);
    expect(isIosDevice(IPADOS_UA, 0)).toBe(false);
    setDevice(IPADOS_UA, 5);
    expect(getInstallSnapshot()).toBe("ios");
  });

  it("beforeinstallprompt — brauzer paneli to'xtatiladi va holat installable, obunachi xabar oladi", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeInstall(listener);
    const event = fireBeforeInstallPrompt();
    expect(event.defaultPrevented).toBe(true);
    expect(getInstallSnapshot()).toBe("installable");
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it("promptInstall: qabul qilinsa — installed va belgi saqlanadi; hodisa bir martalik", async () => {
    const event = fireBeforeInstallPrompt("accepted");
    await expect(promptInstall()).resolves.toBe("accepted");
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(getInstallSnapshot()).toBe("installed");
    expect(window.localStorage.getItem(INSTALLED_STORAGE_KEY)).toBe("1");
    await expect(promptInstall()).resolves.toBe("unavailable");
  });

  it("promptInstall: rad etilsa — installable qoladi, keyingi bosishda oyna yo'q (unavailable)", async () => {
    fireBeforeInstallPrompt("dismissed");
    await expect(promptInstall()).resolves.toBe("dismissed");
    expect(getInstallSnapshot()).toBe("installable");
    await expect(promptInstall()).resolves.toBe("unavailable");
  });

  it("hodisasiz promptInstall — unavailable", async () => {
    await expect(promptInstall()).resolves.toBe("unavailable");
  });

  it("appinstalled — installed; keyingi ochilishda belgi bo'yicha installed, beforeinstallprompt kelsa — belgi tozalanadi", () => {
    fireBeforeInstallPrompt();
    fireAppInstalled();
    expect(getInstallSnapshot()).toBe("installed");
    expect(window.localStorage.getItem(INSTALLED_STORAGE_KEY)).toBe("1");

    // Yangi sahifa ochilishi (modul holati toza, belgi saqlangan).
    resetInstallEnvKeepingStorage();
    expect(getInstallSnapshot()).toBe("installed");

    fireBeforeInstallPrompt();
    expect(getInstallSnapshot()).toBe("installable");
    expect(window.localStorage.getItem(INSTALLED_STORAGE_KEY)).toBeNull();
  });

  it("localStorage bloklangan (xususiy rejim) — xato yutiladi, holat ishlaydi", async () => {
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(getInstallSnapshot()).toBe("unsupported");
    fireBeforeInstallPrompt("accepted");
    await expect(promptInstall()).resolves.toBe("accepted");
    expect(getInstallSnapshot()).toBe("installed");
    get.mockRestore();
    set.mockRestore();
  });
});

/** Modulni «qayta yuklash»: hodisalar va xotira toza, localStorage saqlanadi. */
function resetInstallEnvKeepingStorage() {
  const saved = window.localStorage.getItem(INSTALLED_STORAGE_KEY);
  resetInstallEnv();
  if (saved) window.localStorage.setItem(INSTALLED_STORAGE_KEY, saved);
}

describe("pwa-install: test muhiti tozaligi", () => {
  it("restoreInstallEnv — navigator.userAgent / maxTouchPoints asliga qaytadi (iPhone UA meros qolmaydi)", () => {
    const userAgent = window.navigator.userAgent;
    const maxTouchPoints = window.navigator.maxTouchPoints;
    resetInstallEnv();
    setDevice(IPHONE_UA, 5);
    expect(window.navigator.userAgent).toBe(IPHONE_UA);
    restoreInstallEnv();
    expect(window.navigator.userAgent).toBe(userAgent);
    expect(window.navigator.maxTouchPoints).toBe(maxTouchPoints);
  });
});
