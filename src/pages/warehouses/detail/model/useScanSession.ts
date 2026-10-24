import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  classifyScanCode,
  lookupWarehouseCode,
  normalizeScanCode,
  type WarehouseLookupItem,
} from "../../../../entities/warehouse";
import { playScanFeedback } from "../../../../shared/lib/scanner/feedback";
import { closeScanner, openScanner } from "../../../../shared/lib/scanner/scannerHost";
import { useScanTarget } from "../../../../shared/lib/scanner/scanTargets";
import { useKeyboardScanner } from "../../../../shared/lib/useKeyboardScanner";
import { itemLines, MAX_LINES, scanLinesReducer, type ScanLine } from "./scanLines";

export type ScanSessionOptions = {
  /** Oyna ochiq (skaner tinglaydi, kamera maqsadi faol). */
  open: boolean;
  warehouseId: string | null;
  /** Ixtiyoriy market (`lookup?market_id=`): kod qidiruvi shu market mahsulotlari bilan. */
  marketId: string | null;
  /** Kamera oynasi matnlari (maqsad sarlavhasi, kontekst, yo'riqnoma). */
  camera: { id: string; title: string; context?: string; hint?: string };
  /** Natija ovozi va kamera qatori matnlari. */
  messages: {
    added: (name: string) => string;
    notFound: (code: string) => string;
    unlinked: (code: string) => string;
    ambiguous: (code: string) => string;
    failed: (code: string) => string;
    tooMany: string;
  };
};

/**
 * KIRIM / INVENTARIZATSIYA SKAN SESSIYASI — bitta yo'l: USB skaner (klaviatura kabi, `useKeyboardScanner` — fokus
 * maydonda bo'lmasa), «Mahsulot» maydoni (Enter) va kamera (markaziy skaner oynasi `layer: "dialog"` maqsadi — kamera
 * faqat QR o'qiydi, ya'ni `ELC-P-…` stikerlari; zavod EAN — USB skaner yoki qo'lda). Har kod
 * `GET /warehouses/:id/lookup` ga boradi: bitta mahsulot — qator (+1), bir nechta marketda — tanlov, topilmadi —
 * zavod kodi bo'lsa «Mahsulotga bog'lash», aks holda «topilmadi».
 */
export const useScanSession = ({ open, warehouseId, marketId, camera, messages }: ScanSessionOptions) => {
  const [lines, dispatch] = useReducer(scanLinesReducer, [] as ScanLine[]);
  const [pending, setPending] = useState<string | null>(null);
  const linesRef = useRef(lines);
  useEffect(() => {
    linesRef.current = lines;
  }, [lines]);
  const cameraRequestedRef = useRef(false);
  // Oyna yopilib qolgandan keyin kelgan javob ro'yxatni qayta to'ldirmasin.
  const sessionRef = useRef(0);

  const addItem = useCallback(
    (item: WarehouseLookupItem, options: { resolves?: string; badge?: "linked" } = {}) => {
      const isNew = !itemLines(linesRef.current).some((line) => line.key === item.product.id);
      if (isNew && itemLines(linesRef.current).length >= MAX_LINES) {
        void playScanFeedback("error", messages.tooMany);
        return;
      }
      dispatch({ type: "item", item, ...options });
      void playScanFeedback("success", messages.added(item.product.name));
    },
    [messages],
  );

  const lookup = useCallback(
    async (raw: string, options: { badge?: "linked" } = {}) => {
      const code = normalizeScanCode(raw);
      if (!code || !warehouseId) return;
      const session = sessionRef.current;
      setPending(code);
      try {
        const result = await lookupWarehouseCode(warehouseId, code, marketId ?? undefined);
        if (session !== sessionRef.current) return;
        if (result.items.length === 1) {
          addItem(result.items[0], { resolves: code, badge: options.badge });
        } else if (result.items.length > 1) {
          dispatch({ type: "issue", kind: "ambiguous", code, candidates: result.items });
          void playScanFeedback("missing", messages.ambiguous(code));
        } else if (classifyScanCode(code) === "barcode") {
          dispatch({ type: "issue", kind: "unlinked", code });
          void playScanFeedback("missing", messages.unlinked(code));
        } else {
          dispatch({ type: "issue", kind: "notFound", code });
          void playScanFeedback("missing", messages.notFound(code));
        }
      } catch {
        if (session !== sessionRef.current) return;
        dispatch({ type: "issue", kind: "failed", code });
        void playScanFeedback("error", messages.failed(code));
      } finally {
        if (session === sessionRef.current) setPending(null);
      }
    },
    [addItem, marketId, messages, warehouseId],
  );

  // USB skaner: fokus matn maydonida bo'lmasa (maydonda — maydonning o'z Enter'i ishlaydi).
  useKeyboardScanner({
    enabled: open && Boolean(warehouseId),
    onScan: (value) => {
      void lookup(value);
      return true;
    },
  });

  // Kamera: oyna maqsadi (sahifanikidan ustun). Kamera ochilgan bo'lsa — oyna yopilganda yopiladi.
  useScanTarget(
    open && warehouseId
      ? {
          id: camera.id,
          layer: "dialog",
          title: camera.title,
          context: camera.context,
          hint: camera.hint,
          progress: { done: itemLines(lines).length },
          onScan: (raw) => void lookup(raw),
        }
      : null,
  );
  useEffect(() => {
    if (open || !cameraRequestedRef.current) return;
    cameraRequestedRef.current = false;
    closeScanner();
  }, [open]);
  useEffect(
    () => () => {
      if (cameraRequestedRef.current) closeScanner();
    },
    [],
  );

  const openCamera = useCallback(() => {
    cameraRequestedRef.current = openScanner() === "overlay";
  }, []);

  const reset = useCallback(() => {
    sessionRef.current += 1;
    setPending(null);
    dispatch({ type: "reset" });
  }, []);

  return { lines, dispatch, lookup, addItem, pending, openCamera, reset };
};

export type ScanSession = ReturnType<typeof useScanSession>;
