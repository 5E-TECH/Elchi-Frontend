import { useTranslation } from "react-i18next";

/**
 * BIZNING STATUSNI O'ZBEKCHA KO'RSATISH.
 *
 * ⚠️ NIMA BUZILGAN EDI. Jo'natmalar jadvali `internal_status` ni XOM
 * ko'rsatardi: operator "waiting", "on the road", "cancelled (sent)" degan
 * inglizcha kodlarni o'qishga majbur bo'lardi. Bu bizning ichki
 * qiymatimiz, ya'ni tarjima qilish MUMKIN va KERAK.
 *
 * ⚠️ `provider_status` ESA XOM QOLADI — u tashuvchining O'Z qiymati.
 * Tarjima qilsak haqiqatni yashirardik: "ular aynan nima dedi?" degan
 * savolga javob yo'qolardi va ikki tomon farqini tekshirish imkonsiz
 * bo'lardi.
 *
 * ⚠️ TARJIMA MANBAI YAGONA: `locales/uz/orders.json`. Bu yerda faqat
 * status → kalit xaritasi bor (u `pages/orders/list/OrderStatusBadge.tsx`
 * dagi xarita bilan bir xil). Sahifa i18n'ga to'liq o'tkazilganda bu fayl
 * o'sha umumiy yordamchiga almashtiriladi.
 */

/** Buyurtma statusi → `orders` nomlar fazosidagi tarjima kaliti. */
const STATUS_KEY: Record<string, string> = {
  created: "statusCreated",
  new: "statusNew",
  received: "statusReceived",
  "on the road": "statusOnTheRoad",
  waiting: "statusWaiting",
  waiting_customer: "statusWaiting",
  sold: "statusSold",
  cancelled: "statusCancelled",
  "cancelled (sent)": "statusCancelledSent",
  returned_to_market: "statusCancelled",
  paid: "statusPaid",
  partly_paid: "statusPartlyPaid",
  closed: "statusClosed",
};

export const useStatusLabel = () => {
  const { t } = useTranslation("orders");

  /**
   * `null`/bo'sh — "—" qaytaradi (hali status yo'q).
   *
   * ⚠️ NOMA'LUM qiymat XOM qaytariladi, "—" EMAS. Yangi status qo'shilib
   * xarita yangilanmasa, uni yashirish eng yomon holat bo'lardi: operator
   * "statusi yo'q" deb o'ylardi, holbuki status bor va u boshqa narsani
   * bildiradi.
   */
  return (status?: string | null): string => {
    const raw = String(status ?? "").trim();
    if (!raw) return "—";
    const key = STATUS_KEY[raw];
    return key ? t(key) : raw;
  };
};
