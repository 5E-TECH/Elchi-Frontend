import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import type { DeliveryMeasureItem, DeliveryQuoteByTariffRequest, DeliveryQuotesByTariff } from "../model/types";
import { getPricingSettings, getQuotesByTariff } from "./deliveryPricingApi";

/** Maydon o'zgargandan keyin so'rovgacha kutish — har harfga so'rov ketmasin. */
export const QUOTE_DEBOUNCE_MS = 400;

/** Tarif va qoidalar kam o'zgaradi — bir xil o'lchov qayta so'ralmaydi. */
const STALE_TIME_MS = 60_000;

const useDebouncedValue = <T,>(value: T, delayMs: number): T => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};

export type DeliveryQuoteState = {
  /**
   * `idle` — o'lchov to'liq yoki to'g'ri emas (so'rov yo'q); `loading` — birinchi javob kutilmoqda; `error` —
   * hisoblab bo'lmadi (API yo'q, 409, tarmoq …; forma ishlashda davom etadi); `success` — `quotes` bor.
   */
  status: "idle" | "loading" | "error" | "success";
  quotes: DeliveryQuotesByTariff | undefined;
  /** Ko'rinayotgan narx eski o'lchovniki — yangisi hisoblanmoqda (kutish yoki so'rov). */
  isUpdating: boolean;
  retry: () => void;
};

/**
 * `POST /delivery/quote/by-tariff` — uchala tarif bo'yicha taxminiy narx (hududsiz). `item` — to'g'ri o'lchov yoki
 * `null` (so'rov ketmaydi). O'zgarishdan keyin ~400 ms kutadi; yangi javob kelguncha oldingi narx turadi
 * (`isUpdating`). Xato global xabarsiz (`silentError`) — blok o'zi «Narxni hisoblab bo'lmadi» deydi.
 */
export const useDeliveryQuoteByTariff = (
  item: DeliveryMeasureItem | null,
  { enabled = true, express = false }: { enabled?: boolean; express?: boolean } = {},
): DeliveryQuoteState => {
  // Satr kaliti: har render yangi obyekt kutishni qayta boshlamasin.
  const key = item && enabled ? JSON.stringify({ items: [item], ...(express ? { express } : {}) }) : null;
  const debouncedKey = useDebouncedValue(key, QUOTE_DEBOUNCE_MS);
  const body = useMemo<DeliveryQuoteByTariffRequest | null>(
    () => (debouncedKey ? (JSON.parse(debouncedKey) as DeliveryQuoteByTariffRequest) : null),
    [debouncedKey],
  );

  const query = useQuery({
    queryKey: queryKeys.deliveryPricing.quoteByTariff(body ?? {}),
    queryFn: () => getQuotesByTariff(body as DeliveryQuoteByTariffRequest),
    enabled: body !== null && key !== null,
    staleTime: STALE_TIME_MS,
    retry: false,
    placeholderData: keepPreviousData,
    meta: { silentError: true },
  });

  if (key === null) return { status: "idle", quotes: undefined, isUpdating: false, retry: () => undefined };
  const waiting = key !== debouncedKey;
  const retry = () => void query.refetch();
  if (query.isError && !waiting && !query.isFetching) {
    return { status: "error", quotes: undefined, isUpdating: false, retry };
  }
  if (query.data === undefined) return { status: "loading", quotes: undefined, isUpdating: true, retry };
  return {
    status: "success",
    quotes: query.data,
    isUpdating: waiting || query.isPlaceholderData || query.isFetching,
    retry,
  };
};

/**
 * `GET /delivery/pricing-settings` — faqat superadmin va admin (`enabled`), boshqa rolga 403. Xatoni chaqiruvchi
 * o'zi ko'rsatadi (`silentError`).
 */
export const useDeliveryPricingSettings = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: queryKeys.deliveryPricing.settings,
    queryFn: getPricingSettings,
    enabled,
    staleTime: STALE_TIME_MS,
    meta: { silentError: true },
  });
