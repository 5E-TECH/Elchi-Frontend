import { useCallback, useEffect, useState } from "react";
import { normalizeOrderDetail } from "../../new_orders/components/detail/orderDetailModel";
import type { ScanDetailResponse } from "../lib/scanResource";
import { buildScanPackageView, buildScanPostView } from "./scanBatchView";
import { buildExternalBagView } from "./scanExternalBagView";

/**
 * «OXIRGI SKANERLAR · SHU QURILMADA» (maket `superadmin-scan-camera`, `courier-scan-*`): ochilgan kodlar
 * qurilmada (`localStorage`) saqlanadi — oxirgi 10 ta, eng yangisi tepada, bir token bir marta.
 *
 *   - Kalit foydalanuvchiga bog'langan (`elchi:scan-history:v1:<userId>`): umumiy qurilmada boshqa xodim
 *     oldingisining mijozlarini ko'rmaydi.
 *   - Matn emas, xom maydonlar saqlanadi (raqam, ism, joy, son) — til almashsa ham to'g'ri chiqadi.
 *   - `localStorage` yopiq bo'lishi mumkin (maxfiy oyna, Safari, sayt ma'lumoti bloklangan) — har o'qish va
 *     yozish `try/catch` ichida; tarix bo'lmasa ro'yxat bo'sh holatda chiqadi, skaner ishlayveradi.
 */

export const SCAN_HISTORY_LIMIT = 10;
const STORAGE_PREFIX = "elchi:scan-history:v1:";
const CHANGE_EVENT = "elchi:scan-history-change";

export type ScanHistoryKind = "order" | "package" | "returned-package" | "post" | "external-bag";

export interface ScanHistoryEntry {
  /** `/scan/:token` dagi token (bosilsa shu sahifa ochiladi). */
  token: string;
  kind: ScanHistoryKind;
  /** Buyurtma / pochta raqami yoki paket kodi («B-137»); qopda `null`. */
  ref: string | null;
  /** Buyurtmada mijoz ismi. */
  name: string | null;
  /** Tuman / viloyat / filial. */
  place: string | null;
  /** Paket, pochta, qop ichidagi son. */
  count: number | null;
  /** Ochilgan vaqt (ms). */
  at: number;
}

const storageKey = (userId: string | null | undefined) => `${STORAGE_PREFIX}${userId || "anon"}`;

const isEntry = (value: unknown): value is ScanHistoryEntry => {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<ScanHistoryEntry>;
  return (
    typeof entry.token === "string" &&
    entry.token.length > 0 &&
    typeof entry.kind === "string" &&
    ["order", "package", "returned-package", "post", "external-bag"].includes(entry.kind) &&
    typeof entry.at === "number"
  );
};

export const readScanHistory = (userId: string | null | undefined): ScanHistoryEntry[] => {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, SCAN_HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
};

export const recordScanHistory = (userId: string | null | undefined, entry: ScanHistoryEntry) => {
  try {
    const key = entry.token.toLowerCase();
    const next = [entry, ...readScanHistory(userId).filter((item) => item.token.toLowerCase() !== key)].slice(
      0,
      SCAN_HISTORY_LIMIT,
    );
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Saqlab bo'lmadi (kvota, bloklangan) — tarixsiz davom etamiz.
  }
};

const textOrNull = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/**
 * Skan javobi → tarix yozuvi (`null` — javobda obyekt yo'q, yozilmaydi). Market QR tarixga tushmaydi.
 */
export const toScanHistoryEntry = (
  token: string,
  response: ScanDetailResponse | undefined,
  at = Date.now(),
): ScanHistoryEntry | null => {
  if (!response) return null;
  const base = { token, at, ref: null, name: null, place: null, count: null };
  switch (response.type) {
    case "order": {
      const order = normalizeOrderDetail(response.data);
      if (!order) return null;
      return {
        ...base,
        kind: "order",
        ref: order.id,
        name: textOrNull(order.customer?.name),
        place: textOrNull(order.district?.name) ?? textOrNull(order.region?.name),
      };
    }
    case "package":
    case "returned-package": {
      const view = buildScanPackageView(response.data, response.type);
      if (!view) return null;
      return { ...base, kind: response.type, ref: view.code, place: view.fromBranch, count: view.ordersCount };
    }
    case "post": {
      const view = buildScanPostView(response.data);
      if (!view) return null;
      return { ...base, kind: "post", ref: view.id, place: view.region, count: view.ordersCount };
    }
    case "external-bag": {
      const view = buildExternalBagView(response.data);
      if (!view) return null;
      return { ...base, kind: "external-bag", count: view.count };
    }
    default:
      return null;
  }
};

/** Tarix (o'qish + yangilanish) — boshqa sahifada yozilsa ham (`/scan/:token`) shu yerda yangilanadi. */
export const useScanHistory = (userId: string | null | undefined) => {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>(() => readScanHistory(userId));

  useEffect(() => {
    const refresh = () => setEntries(readScanHistory(userId));
    refresh();
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [userId]);

  const record = useCallback((entry: ScanHistoryEntry) => recordScanHistory(userId, entry), [userId]);
  return { entries, record };
};
