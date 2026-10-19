import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readScannerKey, useKeyboardScanner } from "./useKeyboardScanner";

/**
 * USB/Bluetooth skaner (klaviatura kabi): bufer, Enter, pauza/tozalash va rQX8TqRV tuzatishlari —
 * Caps Lock (registr teskari) va lotin bo'lmagan tartib (`event.code` → US belgi).
 */

type KeyInit = KeyboardEventInit & { capsLock?: boolean };

const keyEvent = ({ capsLock = false, ...init }: KeyInit) => {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  if (capsLock) {
    Object.defineProperty(event, "getModifierState", { value: (key: string) => key === "CapsLock" });
  }
  return event;
};

const press = (init: KeyInit, target: EventTarget = window) => {
  const event = keyEvent(init);
  target.dispatchEvent(event);
  return event;
};

/** Skaner tezligida (pauzasiz) satr + Enter. */
const typeScan = (keys: KeyInit[]) => {
  for (const key of keys) press(key);
  return press({ key: "Enter", code: "Enter" });
};

const latin = (text: string, extra: Partial<KeyInit> = {}): KeyInit[] =>
  [...text].map((char) => ({ key: char, ...extra }));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("readScannerKey", () => {
  it("oddiy lotin belgisi o'zgarmaydi; bir belgidan uzun tugma — null", () => {
    expect(readScannerKey(keyEvent({ key: "a", code: "KeyA" }))).toBe("a");
    expect(readScannerKey(keyEvent({ key: "B", code: "KeyB", shiftKey: true }))).toBe("B");
    expect(readScannerKey(keyEvent({ key: "-", code: "Minus" }))).toBe("-");
    expect(readScannerKey(keyEvent({ key: "Shift", code: "ShiftLeft" }))).toBeNull();
  });

  it("Caps Lock yoqiq — lotin harfining registri teskari (raqamga tegmaydi)", () => {
    expect(readScannerKey(keyEvent({ key: "A", code: "KeyA", capsLock: true }))).toBe("a");
    expect(readScannerKey(keyEvent({ key: "b", code: "KeyB", shiftKey: true, capsLock: true }))).toBe("B");
    expect(readScannerKey(keyEvent({ key: "7", code: "Digit7", capsLock: true }))).toBe("7");
  });

  it("kirill tartib — `event.code` bo'yicha US harfi, katta-kichikligi Shift bo'yicha", () => {
    expect(readScannerKey(keyEvent({ key: "ф", code: "KeyA" }))).toBe("a");
    expect(readScannerKey(keyEvent({ key: "Ф", code: "KeyA", shiftKey: true }))).toBe("A");
    // Caps Lock + kirill: belgi kod va Shift'dan olinadi — registr baribir to'g'ri.
    expect(readScannerKey(keyEvent({ key: "Ф", code: "KeyA", capsLock: true }))).toBe("a");
  });

  it("rus tartibidagi tinish belgilari — US belgisiga (URL'dagi «/» va «:» buzilmaydi)", () => {
    expect(readScannerKey(keyEvent({ key: ".", code: "Slash" }))).toBe("/");
    expect(readScannerKey(keyEvent({ key: "ж", code: "Semicolon", shiftKey: true }))).toBe(":");
    expect(readScannerKey(keyEvent({ key: "ю", code: "Period" }))).toBe(".");
    expect(readScannerKey(keyEvent({ key: '"', code: "Digit2", shiftKey: true }))).toBe("@");
    expect(readScannerKey(keyEvent({ key: "№", code: "Digit3", shiftKey: true }))).toBe("#");
  });

  it("`code` yo'q (ekran klaviaturasi) — `event.key` ishlatiladi", () => {
    expect(readScannerKey(keyEvent({ key: "x" }))).toBe("x");
  });
});

describe("useKeyboardScanner", () => {
  it("Enter bilan butun satr yuboriladi; `true` qaytsa hodisa to'xtatiladi", () => {
    const onScan = vi.fn(() => true);
    renderHook(() => useKeyboardScanner({ onScan }));
    const enter = typeScan(latin("abc123"));
    expect(onScan).toHaveBeenCalledWith("abc123");
    expect(enter.defaultPrevented).toBe(true);
  });

  it("Caps Lock yoqiq — token asl registrda (rQX8TqRV)", () => {
    const onScan = vi.fn();
    renderHook(() => useKeyboardScanner({ onScan }));
    // Skaner «BTB-a1B2» ni yuboradi: katta harflar Shift bilan; Caps Lock ularni teskari qilgan.
    typeScan([
      { key: "b", code: "KeyB", shiftKey: true, capsLock: true },
      { key: "t", code: "KeyT", shiftKey: true, capsLock: true },
      { key: "b", code: "KeyB", shiftKey: true, capsLock: true },
      { key: "-", code: "Minus", capsLock: true },
      { key: "A", code: "KeyA", capsLock: true },
      { key: "1", code: "Digit1", capsLock: true },
      { key: "b", code: "KeyB", shiftKey: true, capsLock: true },
      { key: "2", code: "Digit2", capsLock: true },
    ]);
    expect(onScan).toHaveBeenCalledWith("BTB-a1B2");
  });

  it("rus tartibi yoqiq — havola va token to'g'ri tiklanadi", () => {
    const onScan = vi.fn();
    renderHook(() => useKeyboardScanner({ onScan }));
    const ru: Record<string, KeyInit> = {
      h: { key: "р", code: "KeyH" },
      t: { key: "е", code: "KeyT" },
      p: { key: "з", code: "KeyP" },
      s: { key: "ы", code: "KeyS" },
      ":": { key: "Ж", code: "Semicolon", shiftKey: true },
      "/": { key: ".", code: "Slash" },
      x: { key: "ч", code: "KeyX" },
      ".": { key: "ю", code: "Period" },
      u: { key: "г", code: "KeyU" },
      z: { key: "я", code: "KeyZ" },
      c: { key: "с", code: "KeyC" },
      a: { key: "ф", code: "KeyA" },
      n: { key: "т", code: "KeyN" },
      "1": { key: "1", code: "Digit1" },
      f: { key: "а", code: "KeyF" },
    };
    typeScan([..."https://x.uz/scan/1af"].map((char) => ru[char]));
    expect(onScan).toHaveBeenCalledWith("https://x.uz/scan/1af");
  });

  it("tugmalar orasida pauza (> idleMs) — bufer yangidan boshlanadi (qo'lda yozish skan emas)", () => {
    const onScan = vi.fn();
    renderHook(() => useKeyboardScanner({ onScan, idleMs: 80, clearMs: 350 }));
    press({ key: "a" });
    press({ key: "b" });
    vi.advanceTimersByTime(100);
    press({ key: "c" });
    press({ key: "Enter" });
    expect(onScan).toHaveBeenCalledWith("c");
  });

  it("clearMs dan keyin bufer tozalanadi — kechikkan Enter hech narsa yubormaydi", () => {
    const onScan = vi.fn();
    renderHook(() => useKeyboardScanner({ onScan, idleMs: 1000, clearMs: 350 }));
    press({ key: "a" });
    press({ key: "b" });
    vi.advanceTimersByTime(400);
    press({ key: "Enter" });
    expect(onScan).not.toHaveBeenCalled();
  });

  it("Ctrl/Meta/Alt bilan bosilgan tugma va (sukutda) matn maydonidagi yozuv hisoblanmaydi", () => {
    const onScan = vi.fn();
    renderHook(() => useKeyboardScanner({ onScan }));
    press({ key: "a", ctrlKey: true });
    const input = document.createElement("input");
    document.body.append(input);
    press({ key: "b" }, input);
    press({ key: "c" });
    press({ key: "Enter" });
    expect(onScan).toHaveBeenCalledWith("c");
    input.remove();
  });

  it("captureEditableTargets — maydondagi skan ham ushlanadi; enabled=false — tinglamaydi", () => {
    const onScan = vi.fn();
    const { rerender } = renderHook(({ enabled }) => useKeyboardScanner({ onScan, enabled, captureEditableTargets: true }), {
      initialProps: { enabled: true },
    });
    const input = document.createElement("input");
    document.body.append(input);
    for (const key of ["x", "y", "Enter"]) press({ key }, input);
    expect(onScan).toHaveBeenCalledWith("xy");

    rerender({ enabled: false });
    for (const key of ["q", "Enter"]) press({ key });
    expect(onScan).toHaveBeenCalledTimes(1);
    input.remove();
  });
});
