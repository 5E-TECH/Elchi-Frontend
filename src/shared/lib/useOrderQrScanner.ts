import { useCallback, useMemo } from "react";
import { normalizeScannerCandidates } from "./scanToken";
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
  onMatch: (order: TOrder, rawValue: string) => void;
  onMissing: (rawValue: string) => void;
};

export const useOrderQrScanner = <TOrder extends OrderQrScannerItem>({
  orders,
  enabled = true,
  minLength = 6,
  captureEditableTargets = true,
  onMatch,
  onMissing,
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

  const handleScan = useCallback((rawValue: string) => {
    const candidates = normalizeScannerCandidates(rawValue, window.location.origin);
    const matchedOrder = candidates
      .map((candidate) => orderScanIndex.get(candidate))
      .find(Boolean);

    if (matchedOrder) {
      onMatch(matchedOrder, rawValue);
      return true;
    }

    if (rawValue.trim().length < minLength && !rawValue.includes("/scan/")) {
      return false;
    }

    onMissing(rawValue);
    return true;
  }, [minLength, onMatch, onMissing, orderScanIndex]);

  useKeyboardScanner({
    enabled: enabled && orders.length > 0,
    captureEditableTargets,
    onScan: handleScan,
  });
};
