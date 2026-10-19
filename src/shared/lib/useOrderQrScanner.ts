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
  minLength?: number;
  captureEditableTargets?: boolean;
  onMatch: (order: TOrder, rawValue: string, source: ScanSource) => void;
  onMissing: (rawValue: string, source: ScanSource) => void;
  /**
   * Kamera (kontekstli markaziy tugma, Trello v1eLN2tV): berilsa hook o'zi skan maqsadini ro'yxatdan
   * o'tkazadi (`useScanTarget`). Kamera o'qigan kod USB bilan AYNAN bir xil moslashdan o'tadi
   * (topildi → `onMatch`, aks holda `onMissing`). USB o'chiq bo'lsa (`enabled=false` yoki ro'yxat bo'sh)
   * maqsad ham yo'q — markaziy tugma universal `/scan` ni ochadi.
   */
  camera?: Omit<ScanTarget, "onScan">;
};

export const useOrderQrScanner = <TOrder extends OrderQrScannerItem>({
  orders,
  enabled = true,
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
    const candidates = normalizeScannerCandidates(rawValue, window.location.origin);
    const matchedOrder = candidates
      .map((candidate) => orderScanIndex.get(candidate))
      .find(Boolean);

    if (matchedOrder) {
      onMatch(matchedOrder, rawValue, source);
      return true;
    }

    if (rawValue.trim().length < minLength && !rawValue.includes("/scan/")) {
      return false;
    }

    onMissing(rawValue, source);
    return true;
  }, [minLength, onMatch, onMissing, orderScanIndex]);

  const handleKeyboardScan = useCallback((rawValue: string) => matchScan(rawValue, "keyboard"), [matchScan]);
  const active = enabled && orders.length > 0;

  useKeyboardScanner({
    enabled: active,
    captureEditableTargets,
    onScan: handleKeyboardScan,
  });

  useScanTarget(
    camera && active
      ? {
          ...camera,
          onScan: (rawValue, source) => {
            matchScan(rawValue, source);
          },
        }
      : null,
  );
};
