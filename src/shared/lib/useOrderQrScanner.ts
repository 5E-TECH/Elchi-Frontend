import { useCallback, useMemo } from "react";
import { normalizeScannerCandidates } from "./scanToken";
import { useScanTarget, type ScanSource, type ScanTarget } from "./scanner/scanTargets";
import { useKeyboardScanner } from "./useKeyboardScanner";

type OrderQrScannerItem = {
  id: string | number;
  qr_code_token?: string | null;
};

type UseOrderQrScannerOptions<TOrder extends OrderQrScannerItem> = {
  orders: TOrder[];
  enabled?: boolean;
  /**
   * Vaqtincha to'xtatish (server amali bajarilmoqda): USB skaner tinglanmaydi, kamera skani e'tiborsiz
   * qoladi, lekin kamera maqsadi OLINMAYDI — ochiq kamera yopilmaydi (`enabled=false` dan farqi shu).
   */
  paused?: boolean;
  minLength?: number;
  captureEditableTargets?: boolean;
  onMatch: (order: TOrder, rawValue: string, source: ScanSource) => void;
  onMissing: (rawValue: string, source: ScanSource) => void;
  /**
   * Kamera (kontekstli markaziy tugma, Trello v1eLN2tV): berilsa hook o'zi skan maqsadini ro'yxatdan
   * o'tkazadi (`useScanTarget`). Kamera o'qigan kod USB bilan AYNAN bir xil moslashdan o'tadi
   * (topildi → `onMatch`, aks holda `onMissing`). Maqsad faqat `enabled=false` bo'lsa yo'q (markaziy tugma
   * universal `/scan` ni ochadi). Ro'yxat bo'shligi (yuklanmoqda, hammasi qabul qilindi, bo'sh market) maqsadni
   * OLMAYDI: kamera ochiq qoladi («Qoldi 0», «Tugatish» ko'rinadi), skan esa `onMissing` ga tushadi.
   */
  camera?: Omit<ScanTarget, "onScan">;
};

export const useOrderQrScanner = <TOrder extends OrderQrScannerItem>({
  orders,
  enabled = true,
  paused = false,
  minLength = 6,
  captureEditableTargets = true,
  onMatch,
  onMissing,
  camera,
}: UseOrderQrScannerOptions<TOrder>) => {
  const orderScanIndex = useMemo(() => {
    const index = new Map<string, TOrder>();

    orders.forEach((order) => {
      index.set(String(order.id).toLowerCase(), order);

      const token = order.qr_code_token?.trim();
      if (token) {
        index.set(token.toLowerCase(), order);
      }
    });

    return index;
  }, [orders]);

  const matchScan = useCallback((rawValue: string, source: ScanSource) => {
    if (paused) return false;
    const candidates = normalizeScannerCandidates(rawValue, window.location.origin);
    const matchedOrder = candidates
      .map((candidate) => orderScanIndex.get(candidate))
      .find(Boolean);

    if (matchedOrder) {
      onMatch(matchedOrder, rawValue, source);
      return true;
    }

    // USB: qisqa qiymat — maydonga odam yozgan matn, jim. Kamera / qo'lda kiritish esa ataylab berilgan kod —
    // jim qolmaydi, «topilmadi» bo'ladi (aks holda kamera hech qanday javob bermasdi).
    if (source === "keyboard" && rawValue.trim().length < minLength && !rawValue.includes("/scan/")) {
      return false;
    }

    onMissing(rawValue, source);
    return true;
  }, [minLength, onMatch, onMissing, orderScanIndex, paused]);

  const handleKeyboardScan = useCallback((rawValue: string) => matchScan(rawValue, "keyboard"), [matchScan]);

  useKeyboardScanner({
    enabled: enabled && !paused && orders.length > 0,
    captureEditableTargets,
    onScan: handleKeyboardScan,
  });

  useScanTarget(
    camera && enabled
      ? {
          ...camera,
          onScan: (rawValue, source) => {
            matchScan(rawValue, source);
          },
        }
      : null,
  );
};
