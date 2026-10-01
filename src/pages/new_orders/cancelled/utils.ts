import type { OrderListItem } from "../../../entities/order/types/order";

type CancelledMarket = {
  market_id: string;
  orders_count: number;
  total_price_sum: number;
  market?: {
    id?: string;
    name?: string;
    phone_number?: string;
  };
};

type CancelledMarketRow = {
  market_id: string;
  name: string;
  phone_number: string;
  orders_count: number;
  total_price_sum: number;
};

type OrdersResponse = {
  data?: unknown;
  items?: unknown[];
  orders?: unknown[];
};

const extractItems = <T>(response: unknown): T[] => {
  if (Array.isArray(response)) return response;

  const source = response as OrdersResponse | undefined;
  if (Array.isArray(source?.data)) return source.data as T[];
  if (source?.data && !Array.isArray(source.data)) {
    const data = source.data as OrdersResponse;
    if (Array.isArray(data.items)) return data.items as T[];
    if (Array.isArray(data.orders)) return data.orders as T[];
  }
  if (Array.isArray(source?.items)) return source.items as T[];
  return Array.isArray(source?.orders) ? source.orders as T[] : [];
};

export const extractCancelledOrders = (response: unknown): OrderListItem[] =>
  extractItems<OrderListItem>(response);

/**
 * QR shikastlangan buyurtmani qo'lda tanlash sabablari (fix3 FE-RET-05).
 *
 * `value` — backend `CancelledManualOverrideReasonDto` enum qiymati: AYNAN shu
 * o'zbekcha matnlar (`@IsEnum`). Foydalanuvchiga faqat `labelKey` tarjimasi
 * ko'rsatiladi. Ilgari tarjima qilingan YORLIQ yuborilardi: RU/EN
 * interfeysda ("QR порван") butun topshirish — to'g'ri skanerlanganlari bilan
 * birga — 400 olardi va mollar HQ da qolib ketardi.
 */
export const CANCELLED_MANUAL_REASONS = [
  { value: "QR yirtilgan", labelKey: "cancelledManualReasonTorn" },
  { value: "QR o'qilmayapti", labelKey: "cancelledManualReasonUnreadable" },
  { value: "Label yo'qolgan", labelKey: "cancelledManualReasonMissing" },
  { value: "QR namlangan yoki xiralashgan", labelKey: "cancelledManualReasonWet" },
] as const;

export type CancelledManualReason = (typeof CANCELLED_MANUAL_REASONS)[number]["value"];

export const DEFAULT_CANCELLED_MANUAL_REASON: CancelledManualReason =
  CANCELLED_MANUAL_REASONS[0].value;

/** Backendga faqat enum qiymati ketadi — noma'lum/bo'sh qiymat birinchi sababga tushadi. */
export const toCancelledManualReason = (value: string | null | undefined): CancelledManualReason =>
  CANCELLED_MANUAL_REASONS.find((reason) => reason.value === value)?.value ??
  DEFAULT_CANCELLED_MANUAL_REASON;

export const extractCancelledMarkets = (response: unknown): CancelledMarketRow[] =>
  extractItems<CancelledMarket>(response).map((item) => ({
    market_id: String(item.market_id ?? item.market?.id ?? ""),
    name: item.market?.name ?? "—",
    phone_number: item.market?.phone_number ?? "—",
    orders_count: Number(item.orders_count) || 0,
    total_price_sum: Number(item.total_price_sum) || 0,
  })).filter((item) => item.market_id);
