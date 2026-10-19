import { useEffect, useRef } from "react";

interface UseKeyboardScannerOptions {
  enabled?: boolean;
  idleMs?: number;
  clearMs?: number;
  captureEditableTargets?: boolean;
  onScan: (value: string) => boolean | void;
}

const DEFAULT_IDLE_MS = 80;
const DEFAULT_CLEAR_MS = 350;

/**
 * US tartibidagi belgi (`event.code` → [Shift'siz, Shift bilan]). USB/Bluetooth skaner (HID) tugma
 * KODINI yuboradi va US tartibni nazarda tutadi; OS da boshqa tartib yoqilgan bo'lsa `event.key` boshqa
 * belgi bo'lib keladi (rus/o'zbek kirill: «ф» o'rniga «a», `Slash` → «.»). Kod bo'yicha qaytariladi (rQX8TqRV).
 */
const US_SYMBOLS: Record<string, readonly [string, string]> = {
  Digit1: ["1", "!"],
  Digit2: ["2", "@"],
  Digit3: ["3", "#"],
  Digit4: ["4", "$"],
  Digit5: ["5", "%"],
  Digit6: ["6", "^"],
  Digit7: ["7", "&"],
  Digit8: ["8", "*"],
  Digit9: ["9", "("],
  Digit0: ["0", ")"],
  Minus: ["-", "_"],
  Equal: ["=", "+"],
  Slash: ["/", "?"],
  Period: [".", ">"],
  Comma: [",", "<"],
  Semicolon: [";", ":"],
};

const isPrintableAscii = (value: string) => value.length === 1 && value >= " " && value <= "~";
const isAsciiLetter = (value: string) => /^[A-Za-z]$/.test(value);

/** Caps Lock yoqiqmi (sintetik hodisada `getModifierState` bo'lmasligi mumkin). */
const isCapsLockOn = (event: KeyboardEvent) =>
  typeof event.getModifierState === "function" && event.getModifierState("CapsLock");

const invertCase = (value: string) => (value === value.toUpperCase() ? value.toLowerCase() : value.toUpperCase());

/**
 * Skaner yuborgan belgini tiklaydi:
 *   - lotin harfi: Caps Lock yoqiq bo'lsa registr teskari (skaner katta harfni Shift bilan yuboradi,
 *     Caps Lock uni kichik qilib qo'yadi — token boshqa bo'lib qoladi);
 *   - lotin bo'lmagan belgi (kirill) va `KeyA..KeyZ` — US harfi, katta-kichikligi Shift bo'yicha;
 *   - raqam/tinish tugmasi (`Digit*`, `Minus`, `Slash` …) US belgisiga mos kelmasa — US belgisi (Shift bilan).
 * Boshqa hollarda `event.key` o'zgarmaydi. Bitta belgi bo'lmasa — `null`.
 */
export const readScannerKey = (event: KeyboardEvent): string | null => {
  const { key, code } = event;
  if (key.length !== 1) return null;

  const letter = /^Key([A-Z])$/.exec(code ?? "")?.[1];
  if (letter && !isPrintableAscii(key)) {
    return event.shiftKey ? letter : letter.toLowerCase();
  }

  const symbols = code ? US_SYMBOLS[code] : undefined;
  if (symbols && !symbols.includes(key)) {
    return symbols[event.shiftKey ? 1 : 0];
  }

  if (isAsciiLetter(key) && isCapsLockOn(event)) return invertCase(key);
  return key;
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
};

export const useKeyboardScanner = ({
  enabled = true,
  idleMs = DEFAULT_IDLE_MS,
  clearMs = DEFAULT_CLEAR_MS,
  captureEditableTargets = false,
  onScan,
}: UseKeyboardScannerOptions) => {
  const scannerBufferRef = useRef("");
  const scannerLastKeyAtRef = useRef(0);
  const scannerClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const clearScannerBuffer = () => {
      scannerBufferRef.current = "";
      scannerLastKeyAtRef.current = 0;
    };

    const scheduleScannerClear = () => {
      if (scannerClearTimerRef.current) {
        clearTimeout(scannerClearTimerRef.current);
      }

      scannerClearTimerRef.current = setTimeout(clearScannerBuffer, clearMs);
    };

    const handleScannerKeyDown = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (!captureEditableTargets && isEditableTarget(event.target))
      ) {
        return;
      }

      if (event.key === "Enter") {
        const scannedValue = scannerBufferRef.current.trim();
        clearScannerBuffer();

        if (!scannedValue) return;

        if (onScanRef.current(scannedValue)) {
          event.preventDefault();
        }

        return;
      }

      const char = readScannerKey(event);
      if (char === null) return;

      const now = Date.now();
      if (now - scannerLastKeyAtRef.current > idleMs) {
        scannerBufferRef.current = "";
      }

      scannerBufferRef.current += char;
      scannerLastKeyAtRef.current = now;
      scheduleScannerClear();
    };

    window.addEventListener("keydown", handleScannerKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleScannerKeyDown, true);
      if (scannerClearTimerRef.current) {
        clearTimeout(scannerClearTimerRef.current);
      }
    };
  }, [captureEditableTargets, clearMs, enabled, idleMs]);
};
