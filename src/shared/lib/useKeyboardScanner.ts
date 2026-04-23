import { useEffect, useRef } from "react";

interface UseKeyboardScannerOptions {
  enabled?: boolean;
  idleMs?: number;
  clearMs?: number;
  onScan: (value: string) => boolean | void;
}

const DEFAULT_IDLE_MS = 80;
const DEFAULT_CLEAR_MS = 350;

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
      if (event.ctrlKey || event.metaKey || event.altKey || isEditableTarget(event.target)) {
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

      if (event.key.length !== 1) return;

      const now = Date.now();
      if (now - scannerLastKeyAtRef.current > idleMs) {
        scannerBufferRef.current = "";
      }

      scannerBufferRef.current += event.key;
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
  }, [clearMs, enabled, idleMs]);
};
