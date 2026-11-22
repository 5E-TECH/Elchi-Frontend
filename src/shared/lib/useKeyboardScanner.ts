import { useEffect, useRef } from "react";

interface UseKeyboardScannerOptions {
  enabled?: boolean;
  idleMs?: number;
  clearMs?: number;
  captureEditableTargets?: boolean;
  /**
   * `captureEditableTargets` bilan: skan matni kursor turgan maydonga (qidiruv) ham yoziladi. `true` bo'lsa, skan
   * qabul qilinganda (`onScan` → `true`) maydon skan boshlanishidan oldingi qiymatiga qaytariladi (React'ning
   * `onChange` i ham chaqiriladi). Odam yozgan matn tegilmaydi — u skan deb olinmaydi.
   */
  restoreEditableOnScan?: boolean;
  onScan: (value: string) => boolean | void;
}

type EditableSnapshot = { element: HTMLInputElement | HTMLTextAreaElement; value: string };

const snapshotEditable = (target: EventTarget | null): EditableSnapshot | null =>
  target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
    ? { element: target, value: target.value }
    : null;

/**
 * Boshqariladigan (React) maydon qiymatini tiklash: prototip setter'i orqali yoziladi va `input` hodisasi
 * yuboriladi — React qiymat o'zgarganini ko'radi va `onChange` ni chaqiradi.
 */
const restoreEditableValue = ({ element, value }: EditableSnapshot) => {
  if (!element.isConnected || element.value === value) return;
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(element, value);
  else element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

const DEFAULT_IDLE_MS = 80;

/**
 * Skaner (USB/Bluetooth HID) belgilari orasidagi eng katta oraliq — bundan tezroq kelgan belgilar skaner oqimi
 * (odam bunday tez yozmaydi). Sarlavhaning harfli tezkor tugmalari (`widgets/header/model/headerShortcuts.ts`)
 * shu chegara bilan skan matnini tugma bosish deb olmaydi.
 */
export const SCANNER_KEY_GAP_MS = DEFAULT_IDLE_MS;
const DEFAULT_CLEAR_MS = 350;
/** Oxirgi skan belgisidan Enter gacha eng katta oraliq — keyinroq kelgan Enter skanning oxiri emas. */
export const SCANNER_ENTER_GAP_MS = DEFAULT_CLEAR_MS;

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

/**
 * Skaner yuborgan belgini tiklaydi:
 *   - harf tugmasi (`KeyA..KeyZ`) — harf DOIM `event.code` dan (kirill tartibida «ф» o'rniga «a», QWERTZ'da
 *     y/z almashmaydi). Katta-kichikligi: Caps Lock yoqiq bo'lsa — faqat Shift'dan (Windows/Linux'da Caps+Shift
 *     kichik, macOS'da katta harf beradi — `event.key` ga ishonib bo'lmaydi); Caps Lock o'chiq bo'lsa —
 *     `event.key` ning registridan (Shift'siz katta harf yuboradigan skaner va dasturiy kiritish ham to'g'ri),
 *     registrsiz belgida — Shift'dan;
 *   - raqam/tinish tugmasi (`Digit*`, `Minus`, `Slash` …) US belgisiga mos kelmasa — US belgisi (Shift bilan).
 * Boshqa hollarda (`code` yo'q — ekran klaviaturasi) `event.key` o'zgarmaydi. Bitta belgi bo'lmasa — `null`.
 * Maydonga yozilayotgan matn o'zgarmaydi — faqat skaner buferi.
 */
export const readScannerKey = (event: KeyboardEvent): string | null => {
  const { key, code } = event;
  if (key.length !== 1) return null;

  const letter = /^Key([A-Z])$/.exec(code ?? "")?.[1];
  if (letter) {
    const capsLock = typeof event.getModifierState === "function" && event.getModifierState("CapsLock");
    const hasCase = key.toLowerCase() !== key.toUpperCase();
    const upper = !capsLock && hasCase ? key === key.toUpperCase() : event.shiftKey;
    return upper ? letter : letter.toLowerCase();
  }

  const symbols = code ? US_SYMBOLS[code] : undefined;
  if (symbols && !symbols.includes(key)) {
    return symbols[event.shiftKey ? 1 : 0];
  }

  return key;
};

/**
 * Skaner tinglamaydigan joy (`data-scanner-ignore`): qo'lda kiritish maydoni — odam tez yozib Enter bossa,
 * bufer uni «skan» deb olib, formani to'xtatib qo'ymasin (forma o'zi yuboradi).
 */
export const isIgnoredTarget = (target: EventTarget | null) =>
  target instanceof Element && target.closest("[data-scanner-ignore]") !== null;

export const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
};

/**
 * Tugma bosilgan payt — `event.timeStamp` (hodisa yaratilgan vaqt), ishlov berilgan payt (`Date.now()`) emas.
 * Sahifa band bo'lsa (skan-qabul javobidan keyingi qayta chizish ~50–60 ms, sekin telefonda ko'proq) tugmalar
 * navbatda kutadi va keyin birdan ishlanadi: ishlov vaqti bo'yicha oraliq `idleMs` dan oshib, skanning boshi
 * tashlanardi (2026-11-07, lokal sinov: tez ketma-ket 8 skandan 2 tasi kesilgan token bilan ketdi).
 * Hodisa vaqti esa skaner yuborgan oraliqni saqlaydi.
 */
export const scannerKeyTime = (event: KeyboardEvent) =>
  Number.isFinite(event.timeStamp) && event.timeStamp > 0 ? event.timeStamp : performance.now();

export const useKeyboardScanner = ({
  enabled = true,
  idleMs = DEFAULT_IDLE_MS,
  clearMs = DEFAULT_CLEAR_MS,
  captureEditableTargets = false,
  restoreEditableOnScan = false,
  onScan,
}: UseKeyboardScannerOptions) => {
  const scannerBufferRef = useRef("");
  const scannerLastKeyAtRef = useRef(0);
  /** Skan oqimi boshlangan paytdagi maydon qiymati (`restoreEditableOnScan`). */
  const editableSnapshotRef = useRef<EditableSnapshot | null>(null);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const clearScannerBuffer = () => {
      scannerBufferRef.current = "";
      scannerLastKeyAtRef.current = 0;
      editableSnapshotRef.current = null;
    };

    const handleScannerKeyDown = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (!captureEditableTargets && isEditableTarget(event.target)) ||
        isIgnoredTarget(event.target)
      ) {
        return;
      }

      if (event.key === "Enter") {
        // Oxirgi belgidan `clearMs` dan keyin kelgan Enter — skan emas (bufer eskirgan).
        const stale = scannerKeyTime(event) - scannerLastKeyAtRef.current > clearMs;
        const scannedValue = stale ? "" : scannerBufferRef.current.trim();
        const snapshot = editableSnapshotRef.current;
        clearScannerBuffer();

        if (!scannedValue) return;

        if (onScanRef.current(scannedValue)) {
          event.preventDefault();
          if (restoreEditableOnScan && snapshot && snapshot.element === event.target) {
            restoreEditableValue(snapshot);
          }
        }

        return;
      }

      const char = readScannerKey(event);
      if (char === null) return;

      const now = scannerKeyTime(event);
      if (now - scannerLastKeyAtRef.current > idleMs) {
        scannerBufferRef.current = "";
        // Yangi oqim: `keydown` belgi maydonga yozilishidan OLDIN keladi — qiymat hali skansiz.
        editableSnapshotRef.current = restoreEditableOnScan ? snapshotEditable(event.target) : null;
      }

      scannerBufferRef.current += char;
      scannerLastKeyAtRef.current = now;
    };

    window.addEventListener("keydown", handleScannerKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleScannerKeyDown, true);
    };
  }, [captureEditableTargets, clearMs, enabled, idleMs, restoreEditableOnScan]);
};
