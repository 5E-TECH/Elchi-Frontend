import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/config/queryKeys";
import { DEFAULT_WEIGHT_RULES, toWeightRules, type WeightRules } from "../lib/billableWeight";
import { firstDeliveryQuote } from "../lib/resolveWeights";
import type {
  CreateDeliveryTariffRequest,
  DeliveryMeasureItem,
  DeliveryQuoteByTariffRequest,
  DeliveryQuotesByTariff,
  UpdateDeliveryPricingSettingsRequest,
} from "../model/types";
import {
  createDeliveryTariff,
  getDeliveryTariffs,
  getPricingSettings,
  getPricingSettingsHistory,
  getQuotesByTariff,
  updatePricingSettings,
} from "./deliveryPricingApi";

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

/**
 * Chegarani bilish uchun o'zgarmas namunaviy o'lchov (`POST /delivery/quote/by-tariff` hech narsa yozmaydi; tana bitta —
 * kesh barcha ro'yxat va sahifalarga umumiy). Javobdagi `volumetricFromKg` — serverda qo'llangan chegara.
 */
export const THRESHOLD_PROBE_REQUEST: DeliveryQuoteByTariffRequest = {
  items: [{ weight_kg: 1, length_cm: 10, width_cm: 10, height_cm: 10, volumetric_enabled: true }],
};

export type WeightRulesState = {
  /** `ready` — `rules` bor; `loading` — kutilmoqda; `unknown` — aniqlab bo'lmadi (xato, sozlama yoki tarif yo'q) yoki so'ralmagan. */
  status: "ready" | "loading" | "unknown";
  rules: WeightRules | null;
};

const UNKNOWN_RULES: WeightRulesState = { status: "unknown", rules: null };
const LOADING_RULES: WeightRulesState = { status: "loading", rules: null };

/**
 * RO'YXATDAGI «HISOB VAZNI» QOIDALARI (AQ9lkgVB; mahsulot javobida server hisob vazni yo'q):
 *  - `canReadSettings` (superadmin, admin) — `GET /delivery/pricing-settings` (qadam, minimum, chegara);
 *  - boshqa rol (sozlama 403) — chegara narx javobidan (`THRESHOLD_PROBE_REQUEST`), qadam va minimum — sukut; javobda
 *    chegara yo'q (eski backend) — 0, avvalgi xulq.
 * `enabled: false` — so'rov yo'q (`unknown`).
 */
export const useWeightRules = ({
  canReadSettings,
  enabled = true,
}: {
  canReadSettings: boolean;
  enabled?: boolean;
}): WeightRulesState => {
  const settingsQuery = useDeliveryPricingSettings({ enabled: enabled && canReadSettings });
  const probeQuery = useQuery({
    queryKey: queryKeys.deliveryPricing.quoteByTariff(THRESHOLD_PROBE_REQUEST),
    queryFn: () => getQuotesByTariff(THRESHOLD_PROBE_REQUEST),
    enabled: enabled && !canReadSettings,
    staleTime: STALE_TIME_MS,
    retry: false,
    meta: { silentError: true },
  });
  const settings = settingsQuery.data;
  const probe = probeQuery.data;
  const pending = canReadSettings ? settingsQuery.isPending : probeQuery.isPending;
  return useMemo<WeightRulesState>(() => {
    if (!enabled) return UNKNOWN_RULES;
    if (canReadSettings) {
      if (settings) return { status: "ready", rules: toWeightRules(settings) };
    } else {
      // Faol tarif yo'q (uchala natija `null`) — chegarani bilib bo'lmaydi.
      const quote = firstDeliveryQuote(probe);
      if (quote) return { status: "ready", rules: { ...DEFAULT_WEIGHT_RULES, volumetricFromKg: quote.volumetricFromKg ?? 0 } };
    }
    return pending ? LOADING_RULES : UNKNOWN_RULES;
  }, [canReadSettings, enabled, pending, probe, settings]);
};

/** `GET /delivery/pricing-settings/history` — hisob qoidalari versiyalari (faqat superadmin, admin). */
export const useDeliveryPricingSettingsHistory = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: queryKeys.deliveryPricing.settingsHistory,
    queryFn: getPricingSettingsHistory,
    enabled,
    meta: { silentError: true },
  });

/** `GET /delivery/tariffs` — joriy versiyalar + tarix (faqat superadmin, admin). */
export const useDeliveryTariffs = ({ enabled = true }: { enabled?: boolean } = {}) =>
  useQuery({
    queryKey: queryKeys.deliveryPricing.tariffs,
    queryFn: getDeliveryTariffs,
    enabled,
    meta: { silentError: true },
  });

/**
 * `POST /delivery/tariffs` — yangi versiya. Muvaffaqiyatdan keyin butun `deliveryPricing` keshi yangilanadi:
 * jadval, tarix va kalkulyator (narx yangi tarif bilan qayta so'raladi).
 */
export const useCreateDeliveryTariff = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDeliveryTariffRequest) => createDeliveryTariff(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.deliveryPricing.all }),
  });
};

/** `PATCH /delivery/pricing-settings` — javob darhol keshga, so'ng tariflar va narx taxminlari qayta so'raladi. */
export const useUpdatePricingSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateDeliveryPricingSettingsRequest) => updatePricingSettings(body),
    onSuccess: (settings) => {
      if (settings) queryClient.setQueryData(queryKeys.deliveryPricing.settings, settings);
      return queryClient.invalidateQueries({ queryKey: queryKeys.deliveryPricing.all });
    },
  });
};
