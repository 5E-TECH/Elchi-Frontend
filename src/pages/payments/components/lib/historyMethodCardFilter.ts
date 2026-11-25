import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCashboxCards } from "../../../../entities/payments/cashboxCards";
import { useQueryParams } from "../../../../shared/lib/useQueryParams";
import type { SelectOption } from "../../../../shared/ui/primitives";

/**
 * KRN902pg — kassa tarixining «To'lov usuli» va «Karta» filtrlari (BeePost `cashboxFilters.tsx` dagidek).
 * Backend: `GET finance/history`, `finance/history/daily`, `finance/cashbox/user/:id` — `payment_method`
 * (`cash` | `click` | `click_to_market` | `none`) va `card_id` (karta ID si | `none`); noma'lum qiymat — 400, kuryer /
 * market — 403. Qator kartasi — tarix tafsilotidagi «Karta» bilan bir xil: kartasiz «O'tkazma» — Asosiy karta,
 * kuryer / market qatori — o'tkazmaning HQ kartasi; naqd, «Marketga o'tkazma» va filial kassasi — «Belgilanmagan».
 *
 *  - Filtr URL'da (`payment_method`, `card_id`) — F5 va ulashilgan havola; noto'g'ri qiymat so'rovga ketmaydi.
 *  - «To'lov usuli» — `showsPaymentMethod` qoidasi (P0 63HO6cBU): kuryer filial kassasida usulni ko'rmaydi — u yerda
 *    filtr ham yo'q.
 *  - «Karta» — faqat superadmin/admin va kartali kassa ko'rinishida (asosiy, kuryer, market): filial kassasida karta
 *    yo'q (63HO6cBU), menejer — filial doirasi.
 */
export const PAYMENT_METHOD_FILTER_VALUES = ["cash", "click", "click_to_market", "none"] as const;
export type PaymentMethodFilterValue = (typeof PAYMENT_METHOD_FILTER_VALUES)[number];
export const CARD_FILTER_NONE = "none";
const CARD_ID = /^\d{1,18}$/;

/** URL'dagi qiymat — ruxsat etilgani yoki bo'sh (so'rovga noto'g'ri qiymat ketmaydi: backend 400 berardi). */
export const readPaymentMethodFilter = (raw: string | null | undefined): string =>
  (PAYMENT_METHOD_FILTER_VALUES as readonly string[]).includes(raw ?? "") ? String(raw) : "";

export const readCardFilter = (raw: string | null | undefined): string =>
  raw === CARD_FILTER_NONE || CARD_ID.test(raw ?? "") ? String(raw) : "";

export type MethodCardFilters = { payment_method: string; card_id: string };

/** «Filtrlarni tozalash» uchun (bo'sh qiymat URL'dan o'chiriladi). */
export const EMPTY_METHOD_CARD_FILTERS: MethodCardFilters = { payment_method: "", card_id: "" };

/** So'rov parametrlari: faqat ko'rinadigan va to'ldirilgan filtrlar. */
export const methodCardParams = (
  filters: MethodCardFilters,
  visible: { method: boolean; card: boolean },
): Partial<MethodCardFilters> => ({
  ...(visible.method && filters.payment_method ? { payment_method: filters.payment_method } : {}),
  ...(visible.card && filters.card_id ? { card_id: filters.card_id } : {}),
});

export const usePaymentMethodFilterOptions = (): SelectOption[] => {
  const { t } = useTranslation("payments");
  return useMemo(
    () =>
      PAYMENT_METHOD_FILTER_VALUES.map((value) => ({
        value,
        label: t(`historyFilters.methods.${value}`),
      })),
    [t],
  );
};

/**
 * Kassa kartalari (arxivlanganlari ham — tarixda ularning qatorlari bor) + «Belgilanmagan». `requested` — filtr shu
 * ko'rinishda bormi (rol va kassa bo'yicha — chaqiruvchi hal qiladi). Ro'yxat sahifa ochilganda SO'RALMAYDI: faqat
 * tanlov ochilganda (`onOpen`) yoki URL'da karta ID si bo'lsa (chip / maydon nomi uchun) — ortiqcha so'rov yo'q.
 */
export const useCardFilterOptions = (requested: boolean, selectedCardId = "") => {
  const { t } = useTranslation("payments");
  const [opened, setOpened] = useState(false);
  const needsList = requested && (opened || (selectedCardId !== "" && selectedCardId !== CARD_FILTER_NONE));
  const query = useCashboxCards({ includeInactive: true, enabled: needsList });
  const list = query.data;
  const options = useMemo<SelectOption[]>(() => {
    const cards = (list?.cards ?? []).map((card) => ({
      value: card.id,
      label: card.is_active || card.is_default ? card.name : t("historyFilters.cardArchived", { name: card.name }),
      description: card.last4 ? `•• ${card.last4}` : undefined,
    }));
    return [
      ...cards,
      { value: CARD_FILTER_NONE, label: t("historyFilters.cardNone"), description: t("historyFilters.cardNoneHint") },
    ];
  }, [list, t]);
  const onOpen = useCallback(() => setOpened(true), []);
  return {
    options,
    loading: needsList && query.isLoading,
    available: requested,
    onOpen,
  };
};

/**
 * `/payments/main-cashbox` va `/payments/cash-detail/:id`: filtr URL'da (`payment_method`, `card_id`). `allowCard =
 * false` — URL'dagi `card_id` e'tiborsiz (filtr ko'rinmaydigan joyda so'rovga ketmaydi). `update` / `clear` — bitta
 * URL yangilanishi; sahifani 1-ga qaytarish — chaqiruvchida (`onChange`).
 */
export const useMethodCardUrlFilters = (allowCard: boolean, onChange?: () => void) => {
  const { getParam, setMultipleParams } = useQueryParams();
  const rawMethod = getParam("payment_method");
  const rawCard = getParam("card_id");
  const filters = useMemo<MethodCardFilters>(
    () => ({
      payment_method: readPaymentMethodFilter(rawMethod),
      card_id: allowCard ? readCardFilter(rawCard) : "",
    }),
    [allowCard, rawCard, rawMethod],
  );
  const update = useCallback(
    (patch: Partial<MethodCardFilters>) => {
      setMultipleParams({ ...patch } as Record<string, string>);
      onChange?.();
    },
    [onChange, setMultipleParams],
  );
  const clear = useCallback(() => update(EMPTY_METHOD_CARD_FILTERS), [update]);
  const activeCount = (filters.payment_method ? 1 : 0) + (filters.card_id ? 1 : 0);
  return { filters, update, clear, activeCount };
};
