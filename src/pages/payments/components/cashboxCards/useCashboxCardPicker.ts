import { useCallback, useMemo } from "react";
import { useCashboxCards, type CashboxCard } from "../../../../entities/payments/cashboxCards";

/**
 * TO'LOVDA «QAYSI KARTA» TANLOVI (cards1111b — BeePost'dagi kabi: «Karta (Click)» to'lovida pul qaysi kartaga
 * tushadi / qaysi kartadan chiqadi). Backend (3PE0B03q / Zv3MLn0a) `card_id` ni allaqachon qabul qiladi:
 * `PATCH cashbox/fill|spend`, `POST cashbox/payment/courier|market` va `payment/branch-to-main` (`card_id` — HQ,
 * `branch_card_id` — filial). Kassa doirasi JWT'dan (superadmin/admin — asosiy kassa, menejer — o'z filiali);
 * `branchId` — admin filial kassasining kartalarini o'qiydi.
 *
 *  - Faqat FAOL kartalar, Asosiy karta birinchi va SUKUT (BeePost: `card_id` berilmasa — default karta).
 *  - Faol karta bitta (faqat Asosiy) — maydon chizilmaydi: tanlash yo'q, so'rov avvalgidek.
 *  - So'rovga: NOMLI karta tanlansa — uning ID si; Asosiy karta — `card_id` YUBORILMAYDI (backend sukuti — avvalgi
 *    xatti-harakat o'zgarmaydi). Nomli kartadan chiqimda kartada yetmasa backend 400 («… kartasida yetarli mablag'
 *    yo'q») — maydon ostida ham oldindan aytiladi.
 *  - Ro'yxat o'qilmasa — maydon ostida sabab va «Qayta urinish»; to'lov Asosiy kartaga ketadi (bloklanmaydi).
 *  - `card_id` idempotentlik barmoq iziga KIRMAYDI (chek kabi): javobi yo'qolgan to'lov boshqa karta bilan qayta
 *    bosilsa ham pul ikki marta o'tmaydi.
 */

export type CardDirection = "in" | "out";

export type CashboxCardPicker = {
  /** Faol kartalar (Asosiy birinchi). */
  cards: CashboxCard[];
  defaultCard: CashboxCard | null;
  /** Tanlash ma'noli: nomli faol karta bor (yoki ro'yxat o'qilmoqda / xato — foydalanuvchi bilsin). */
  available: boolean;
  loading: boolean;
  failed: boolean;
  retry: () => void;
  /** Tanlangan (yoki sukut — Asosiy) karta. */
  resolve: (id: string | null | undefined) => CashboxCard | null;
  /** So'rovdagi `card_id`: faqat nomli karta (Asosiy — `undefined`). */
  requestId: (id: string | null | undefined) => string | undefined;
  /**
   * Chiqimda NOMLI kartada summa yetmaydi — o'sha karta (maydon ostida xato, yuborish to'xtaydi; backend ham 400).
   * Asosiy karta — `null` (`card_id` ketmaydi, backend uni tekshirmaydi — avvalgidek).
   */
  shortOf: (id: string | null | undefined, amount: number) => CashboxCard | null;
};

export const useCashboxCardPicker = ({
  enabled,
  branchId = null,
}: {
  enabled: boolean;
  branchId?: string | null;
}): CashboxCardPicker => {
  const query = useCashboxCards({ includeInactive: false, enabled, branchId });
  const cards = useMemo(() => (query.data?.cards ?? []).filter((card) => card.is_active || card.is_default), [query.data]);
  const defaultCard = useMemo(() => cards.find((card) => card.is_default) ?? null, [cards]);
  const loading = enabled && query.isLoading;
  const failed = enabled && query.isError && cards.length === 0;
  const { refetch } = query;
  const retry = useCallback(() => void refetch(), [refetch]);
  const resolve = useCallback(
    (id: string | null | undefined) => (id ? cards.find((card) => card.id === id) : undefined) ?? defaultCard,
    [cards, defaultCard],
  );
  const requestId = useCallback(
    (id: string | null | undefined) => {
      const card = id ? cards.find((item) => item.id === id) : undefined;
      return card && !card.is_default ? card.id : undefined;
    },
    [cards],
  );
  const shortOf = useCallback(
    (id: string | null | undefined, amount: number) => {
      const card = id ? cards.find((item) => item.id === id) : undefined;
      return card && !card.is_default && amount > 0 && amount > card.balance ? card : null;
    },
    [cards],
  );
  return {
    cards,
    defaultCard,
    available: enabled && (loading || failed || cards.length > 1),
    loading,
    failed,
    retry,
    resolve,
    requestId,
    shortOf,
  };
};
